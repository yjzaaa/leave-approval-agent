/**
 * useAgent — 聊天状态机 Hook v4.0
 *
 * 核心职责:
 *   1. SSE 流式对话管理
 *   2. 确认流程 — 去重由 lastConfirmToolRef 实现
 *   3. 阶段追踪 — SSE 事件驱动
 *   4. 记忆注入 — 把用户记忆和对话摘要传给后端
 *   5. 压缩触发 — 消息数超阈值时调 /api/compact
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Message, ConfirmRequest, AgentPhase, ChatHistory } from '../types';
import type { MemoryItem } from '../../shared/memory';
import { MEMORY_LIMITS } from '../../shared/memory';


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

  // ── 压缩对话历史 ──
  const compactHistory = useCallback(async (oldMessages: Message[]) => {
    if (oldMessages.length < MEMORY_LIMITS.compactThreshold) return;
    try {
      const res = await fetch('/api/compact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: oldMessages,
          plugin: pluginIdRef.current,
        }),
      });
      const data = await res.json();
      if (data.summary && onSummaryUpdate) {
        onSummaryUpdate(data.summary, oldMessages.length);
      }
    } catch { /* 压缩失败不影响主流程 */ }
  }, [onSummaryUpdate]);

  // ── 提取记忆 ──
  const extractMemories = useCallback(async (recentMessages: Message[]) => {
    if (!onMemoriesExtracted) return;
    try {
      const res = await fetch('/api/extract-memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: recentMessages,
          plugin: pluginIdRef.current,
        }),
      });
      const data = await res.json();
      if (data && onMemoriesExtracted) {
        onMemoriesExtracted(data);
      }
    } catch { /* 提取失败不影响主流程 */ }
  }, [onMemoriesExtracted]);

  // ── SSE 流处理 ──

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
  }, [isStreaming, messages, addMessage, updateLastAssistant, compactHistory, extractMemories]);

  // ── 确认处理 ──

  const confirm = useCallback(async (approved: boolean) => {
    if (!confirmRequest) return;

    lastConfirmToolRef.current = confirmRequest.tool;
    setConfirmRequest(null);

    try {
      await fetch('/api/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved }),
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
  }, []);

  return {
    messages, phase, phaseText, confirmRequest,
    isStreaming, error,
    sendMessage, confirm, reset,
  };
}