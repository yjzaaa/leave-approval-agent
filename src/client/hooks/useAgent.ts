/**
 * useAgent — 聊天状态机 Hook v3.0
 *
 * 与业务解耦的版本：
 *   - 不再硬编码 tool 名称（submit_form / start_process）
 *   - 不再硬编码阶段标签（填表 / 校验）
 *   - confirm_required 事件中 tool/label/fieldLabels 全部由后端插件动态提供
 *
 * 核心职责：
 *   1. SSE 流式对话管理
 *   2. 确认流程 — 去重由 lastConfirmToolRef（按 tool 名）实现
 *   3. 阶段追踪 — 由 SSE 事件驱动，StatusBar 根据插件 pipeline 渲染
 *   4. 消息管理
 */
import { useCallback, useRef, useState } from 'react';
import type { Message, ConfirmRequest, AgentPhase } from '../types';

export function useAgent(pluginId?: string) {
  // ── 状态 ──
  const [messages, setMessages] = useState<Message[]>([]);
  const [phase, setPhase] = useState<AgentPhase>('idle');
  const [phaseText, setPhaseText] = useState('请输入您的需求');
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Refs ──
  const abortRef = useRef<AbortController | null>(null);
  const lastConfirmToolRef = useRef<string | null>(null);
  const pluginIdRef = useRef<string>(pluginId || 'leave_approval');

  // 同步外部 pluginId 变化
  pluginIdRef.current = pluginId || 'leave_approval';

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

  // ── SSE 流处理 ──

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;

    setIsStreaming(true);
    setError(null);
    setConfirmRequest(null);
    lastConfirmToolRef.current = null;
    addMessage('user', text);

    const history = messages
      .filter(m => m.role !== 'system')
      .slice(-20)
      .map(m => ({ role: m.role, content: m.content }));

    addMessage('assistant', '');
    setPhase('processing');
    setPhaseText('Agent 正在处理...');

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history, plugin: pluginIdRef.current }),
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
              // ── 流式文本 ──
              case 'text':
                fullText += data.content;
                updateLastAssistant(fullText);
                break;

              // ── 确认请求（通用化：不再限定 tool 名称） ──
              case 'confirm_required':
                if (lastConfirmToolRef.current === data.tool) {
                  console.log('[SSE] confirm_required ignored: duplicate for', data.tool);
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

              // ── 确认已处理 ──
              case 'confirm_resolved':
                setConfirmRequest(null);
                setPhase('processing');
                setPhaseText('Agent 正在处理...');
                break;

              // ── Tool 执行结果 ──
              case 'tool_result':
                // 阶段切换由 StatusBar 根据 event.tool 自动处理
                break;

              // ── 流程结束 ──
              case 'done':
                setPhase('done');
                setPhaseText('流程结束');
                setConfirmRequest(null);
                lastConfirmToolRef.current = null;
                break;

              // ── 错误 ──
              case 'error':
                updateLastAssistant(fullText + '\n\n⚠️ ' + data.message);
                setPhase('error');
                setPhaseText(data.message as string);
                setError(data.message as string);
                break;
            }
          } catch { /* 跳过解析失败的 JSON */ }
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
  }, [isStreaming, messages, addMessage, updateLastAssistant]);

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

    addMessage('system', approved
      ? `✓ 已确认`
      : `✕ 已拒绝`);
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
  }, []);

  return {
    messages, phase, phaseText, confirmRequest,
    isStreaming, error,
    sendMessage, confirm, reset,
  };
}
