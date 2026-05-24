/**
 * useAgent — 聊天状态机 Hook v5.0
 *
 * 核心职责:
 *   1. SSE 流式对话管理（server 模式）/ 直接 Agent 调用（local 模式）
 *   2. 确认流程 — 去重由 lastConfirmToolRef 实现
 *   3. 阶段追踪 — 事件驱动
 *   4. 记忆注入 — 把用户记忆和对话摘要传给后端/Agent
 *   5. 压缩触发 — 消息数超阈值时执行对话压缩
 *
 * 模式切换:
 *   - npm run dev (MODE = "development") → local 模式，直接调用 runAgent()
 *   - npm run dev:all (MODE = "server")    → server 模式，fetch /api/chat SSE
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Message, ConfirmRequest, AgentPhase, ChatHistory } from '../types';
import type { MemoryItem } from '../../shared/memory';
import { MEMORY_LIMITS } from '../../shared/memory';

/** 非 "server" 模式均视为 local */
const isLocal = import.meta.env.MODE !== 'server';

interface UseAgentOptions {
  pluginId?: string;
  userId?: string;
  memories?: MemoryItem[];
  summary?: string;
  onSummaryUpdate?: (summary: string, messageCount: number) => void;
  onMemoriesExtracted?: (memories: { user: string[]; feedback: string[]; project: string[]; reference: string[] }) => void;
}

export function useAgent(options?: UseAgentOptions) {
  const pluginId = options?.pluginId;
  const userId = options?.userId;
  const memories = options?.memories;
  const summary = options?.summary;
  const onSummaryUpdate = options?.onSummaryUpdate;
  const onMemoriesExtracted = options?.onMemoriesExtracted;

  // ── 状态 ──
  const [messages, setMessages] = useState<Message[]>(() => {
    if (!userId) return [];
    try {
      const raw = localStorage.getItem(`chat_history_${userId}`);
      if (raw) {
        const history: ChatHistory = JSON.parse(raw);
        return history.messages || [];
      }
    } catch { /* ignore */ }
    return [];
  });
  const [phase, setPhase] = useState<AgentPhase>('idle');
  const [phaseText, setPhaseText] = useState('请输入您的需求');
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Session ID（页面加载时生成，同一会话内所有请求共用） ──
  const sessionIdRef = useRef<string>(
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );

  // ── 聊天历史持久化 ──
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!userId || messages.length === 0) return;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      try {
        const history: ChatHistory = {
          messages,
          activePluginId: pluginId || 'leave_approval',
          lastActiveAt: Date.now(),
        };
        localStorage.setItem(`chat_history_${userId}`, JSON.stringify(history));
      } catch { /* quota */ }
    }, 500);
    return () => clearTimeout(saveTimerRef.current);
  }, [messages, userId, pluginId]);

  // ── Refs ──
  const abortRef = useRef<AbortController | null>(null);
  const lastConfirmToolRef = useRef<string | null>(null);
  const pluginIdRef = useRef<string>(pluginId || 'leave_approval');
  const memoriesRef = useRef<MemoryItem[]>(memories || []);
  const summaryRef = useRef<string>(summary || '');
  const messageCountRef = useRef(0);
  // local 模式的 HITL 管理器引用（server 模式通过 /api/confirm 间接操作）
  const hitlRef = useRef<any>(null);

  // 同步外部变化
  pluginIdRef.current = pluginId || 'leave_approval';
  memoriesRef.current = memories || [];
  summaryRef.current = summary || '';

  // ── 消息管理 ──

  const addMessage = useCallback((role: Message['role'], content: string) => {
    const msg: Message = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      role, content, timestamp: Date.now(),
    };
    setMessages(prev => [...prev, msg]);
    return msg;
  }, []);

  const updateLastAssistant = useCallback((content: string) => {
    setMessages(prev => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      if (last.role !== 'assistant') {
        return [...prev, { id: Date.now().toString(36), role: 'assistant', content, timestamp: Date.now() }];
      }
      return [...prev.slice(0, -1), { ...last, content }];
    });
  }, []);

  // ── 压缩对话历史（server 模式: HTTP; local 模式: 进程内） ──
  const compactHistory = useCallback(async (oldMessages: Message[]) => {
    if (oldMessages.length < MEMORY_LIMITS.compactThreshold) return;
    try {
      let result: string | null = null;

      if (isLocal) {
        const { compactHistoryLocal } = await import('../../agent/local-utils.js');
        result = await compactHistoryLocal(
          oldMessages.map(m => ({ role: m.role, content: m.content }))
        );
      } else {
        const res = await fetch('/api/compact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: oldMessages.map(m => ({ role: m.role, content: m.content })),
            plugin: pluginIdRef.current,
          }),
        });
        const data = await res.json();
        result = data.summary || null;
      }

      if (result && onSummaryUpdate) {
        onSummaryUpdate(result, oldMessages.length);
      }
    } catch { /* 压缩失败不影响主流程 */ }
  }, [onSummaryUpdate]);

  // ── 提取记忆（server 模式: HTTP; local 模式: 进程内） ──
  const extractMemories = useCallback(async (recentMessages: Message[]) => {
    if (!onMemoriesExtracted) return;
    try {
      if (isLocal) {
        const { extractMemoriesLocal } = await import('../../agent/local-utils.js');
        const data = await extractMemoriesLocal(
          recentMessages.map(m => ({ role: m.role, content: m.content }))
        );
        onMemoriesExtracted(data);
      } else {
        const res = await fetch('/api/extract-memories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: recentMessages.map(m => ({ role: m.role, content: m.content })),
            plugin: pluginIdRef.current,
          }),
        });
        const data = await res.json();
        if (data && onMemoriesExtracted) {
          onMemoriesExtracted(data);
        }
      }
    } catch { /* 提取失败不影响主流程 */ }
  }, [onMemoriesExtracted]);

  // ── 流处理 ──

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;

    setIsStreaming(true);
    setError(null);
    setConfirmRequest(null);
    lastConfirmToolRef.current = null;
    addMessage('user', text);
    messageCountRef.current += 1;

    // 触发记忆提取 (每 N 轮)
    if (messageCountRef.current > 0 && messageCountRef.current % MEMORY_LIMITS.extractInterval === 0) {
      extractMemories(messages.slice(-10));
    }

    // 构建 history: 去掉 system 消息，取最近消息
    const history = messages
      .filter(m => m.role !== 'system')
      .slice(-20)
      .map(m => ({ role: m.role, content: m.content }));

    // 检查是否需要压缩
    if (messages.length >= MEMORY_LIMITS.compactThreshold) {
      compactHistory(messages.slice(0, -8));
    }

    addMessage('assistant', '');
    setPhase('processing');
    setPhaseText('Agent 正在处理...');

    // ── Local 模式：直接调用 runAgent ──
    if (isLocal) {
      let fullText = '';

      try {
        const [{ runAgent }, { getPlugin }, { createTracer }] = await Promise.all([
          import('../../agent/agent-factory.js'),
          import('../../plugins/registry.js'),
          import('../../agent/mlflow-tracer.js'),
        ]);

        const plugin = getPlugin(pluginIdRef.current);

        const tracer = createTracer({
          plugin: plugin.id,
          userId: userId,
          sessionId: `local-${Date.now()}`,
          message: text,
        });

        const hitl = await tracer.run(async () => {
          return runAgent({
          plugin,
          message: text,
          history,
          memories: memoriesRef.current,
          summary: summaryRef.current,
          onSSE: (event, data) => {
            switch (event) {
              case 'text':
                fullText += data.content as string;
                updateLastAssistant(fullText);
                break;

              case 'confirm_required':
                if (lastConfirmToolRef.current === data.tool) break;
                setConfirmRequest({
                  tool: data.tool as string,
                  label: data.label as string,
                  form: data.form as Record<string, string>,
                  fieldLabels: data.fieldLabels as Record<string, string>,
                });
                setPhase('awaiting_confirm');
                setPhaseText((data.label as string) || '请确认');
                break;

              case 'confirm_resolved':
                setConfirmRequest(null);
                setPhase('processing');
                setPhaseText('Agent 正在处理...');
                break;

              case 'tool_result':
                break;

              case 'done':
                setPhase('done');
                setPhaseText('流程结束');
                setConfirmRequest(null);
                lastConfirmToolRef.current = null;
                break;

              case 'error':
                updateLastAssistant(fullText + '\n\n⚠️ ' + data.message);
                setPhase('error');
                setPhaseText(data.message as string);
                setError(data.message as string);
                break;
            }
          },
          onHitlCreated: (h) => {
            hitlRef.current = h;
          },
          tracer,
        });
        });
        // runAgent 返回时流程已结束，保持 hitl 引用供下次使用
        void hitl;
      } catch (err: any) {
        // 用户拒绝 HITL 也会抛错，这是正常流程，不显示错误
        if (err.message?.includes('用户拒绝')) {
          setPhase('done');
          setPhaseText('流程结束');
        } else {
          setError(err.message || String(err));
          setPhase('error');
          setPhaseText('连接失败');
          updateLastAssistant('⚠️ 错误: ' + (err.message || String(err)));
        }
      } finally {
        setIsStreaming(false);
        hitlRef.current = null;
      }
      return;
    }

    // ── Server 模式：SSE over HTTP（原有逻辑） ──
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history,
          plugin: pluginIdRef.current,
          memories: memoriesRef.current,
          summary: summaryRef.current,
          userId,
          sessionId: sessionIdRef.current,
        }),
        signal: controller.signal,
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let eventType = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
            continue;
          }
          if (!line.startsWith('data: ')) continue;

          try {
            const data = JSON.parse(line.slice(6));
            if (eventType !== 'text') {
              console.log('[SSE] event:', eventType, JSON.stringify(data).slice(0, 100));
            }

            switch (eventType) {
              case 'text':
                fullText += data.content;
                updateLastAssistant(fullText);
                break;

              case 'confirm_required':
                if (lastConfirmToolRef.current === data.tool) {
                  console.log('[SSE] confirm_required ignored: duplicate');
                  break;
                }
                setConfirmRequest({
                  tool: data.tool,
                  label: data.label,
                  form: data.form,
                  fieldLabels: data.fieldLabels,
                });
                setPhase('awaiting_confirm');
                setPhaseText(data.label || '请确认');
                break;

              case 'confirm_resolved':
                setConfirmRequest(null);
                setPhase('processing');
                setPhaseText('Agent 正在处理...');
                break;

              case 'tool_result':
                break;

              case 'done':
                setPhase('done');
                setPhaseText('流程结束');
                setConfirmRequest(null);
                lastConfirmToolRef.current = null;
                break;

              case 'error':
                updateLastAssistant(fullText + '\n\n⚠️ ' + data.message);
                setPhase('error');
                setPhaseText(data.message as string);
                setError(data.message as string);
                break;
            }
          } catch { /* 跳过解析失败 */ }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message);
        setPhase('error');
        setPhaseText('连接失败');
        updateLastAssistant('⚠️ 连接失败: ' + err.message);
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [isStreaming, messages, addMessage, updateLastAssistant, compactHistory, extractMemories, userId]);

  // ── 确认处理 ──

  const confirm = useCallback(async (approved: boolean) => {
    if (!confirmRequest) return;

    lastConfirmToolRef.current = confirmRequest.tool;
    setConfirmRequest(null);

    // Local 模式：直接操作 HitlManager
    if (isLocal && hitlRef.current) {
      if (approved) {
        hitlRef.current.approve();
      } else {
        hitlRef.current.reject();
      }
      addMessage('system', approved ? '✓ 已确认' : '✕ 已拒绝');
      return;
    }

    // Server 模式：POST /api/confirm
    try {
      await fetch('/api/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved, sessionId: sessionIdRef.current }),
      });
    } catch { /* 忽略 */ }

    addMessage('system', approved ? '✓ 已确认' : '✕ 已拒绝');
  }, [confirmRequest, addMessage]);

  // ── 重置 ──

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setPhase('idle');
    setPhaseText('请输入您的需求');
    setConfirmRequest(null);
    setIsStreaming(false);
    setError(null);
    lastConfirmToolRef.current = null;
    messageCountRef.current = 0;
    hitlRef.current = null;
  }, []);

  return {
    messages, phase, phaseText, confirmRequest,
    isStreaming, error,
    sendMessage, confirm, reset,
  };
}
