/**
 * useAgent — 薄 React Hook 包装
 *
 * 职责:
 *   1. 管理 React 状态（messages, phase, confirmRequest 等）
 *   2. 持久化聊天历史到 localStorage
 *   3. 将 AgentSession 的 onEvent 回调映射到 React setState
 *   4. 对外暴露统一的状态和操作接口
 *
 * 业务逻辑全部委托给 useAgentCore.ts 的 createAgentSession()
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Message, ConfirmRequest, AgentPhase, ChatHistory } from '../../views/types';
import type { MemoryItem } from '../../models/domain/models/MemoryItem';
import type { AgentEvent, SimpleMessage } from './useAgentCore';
import { createAgentSession } from './useAgentCore';

/** useAgent Hook 配置选项 */
interface UseAgentOptions {
  scenarioId?: string;
  userId?: string;
  memories?: MemoryItem[];
  summary?: string;
  onSummaryUpdate?: (summary: string, messageCount: number) => void;
  onMemoriesExtracted?: (memories: { user: string[]; feedback: string[]; project: string[]; reference: string[] }) => void;
}

export function useAgent(options?: UseAgentOptions) {
  const { t } = useTranslation();
  const scenarioId = options?.scenarioId;
  const userId = options?.userId;
  const memories = options?.memories;
  const summary = options?.summary;
  const onSummaryUpdate = options?.onSummaryUpdate;
  const onMemoriesExtracted = options?.onMemoriesExtracted;

  // ── React 状态 ──

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
  const [phaseText, setPhaseText] = useState(t('agent.enterRequest'));
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Refs ──

  /** Session ID（页面加载时生成，同一会话内所有请求共用） */
  const sessionIdRef = useRef<string>(
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  /** 消息计数器（用于触发记忆提取） */
  const messageCountRef = useRef(0);
  /** 聊天历史持久化定时器 */
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  /** AgentSession 实例引用 */
  const sessionRef = useRef<ReturnType<typeof createAgentSession> | null>(null);
  /** 同步最新场景 ID */
  const scenarioIdRef = useRef<string>(scenarioId || 'leave_approval');
  /** 同步最新记忆 */
  const memoriesRef = useRef<MemoryItem[]>(memories || []);
  /** 同步最新摘要 */
  const summaryRef = useRef<string>(summary || '');
  /** 确认请求快照（供 confirm 读取 tool） */
  const confirmToolRef = useRef<string>('');

  // 同步外部变化
  scenarioIdRef.current = scenarioId || 'leave_approval';
  memoriesRef.current = memories || [];
  summaryRef.current = summary || '';

  // ── 聊天历史持久化 ──

  useEffect(() => {
    if (!userId || messages.length === 0) return;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      try {
        const history: ChatHistory = {
          messages,
          activeScenarioId: scenarioIdRef.current,
          lastActiveAt: Date.now(),
        };
        localStorage.setItem(`chat_history_${userId}`, JSON.stringify(history));
      } catch { /* quota */ }
    }, 500);
    return () => clearTimeout(saveTimerRef.current);
  }, [messages, userId]);

  // ── 消息管理 ──

  /** 添加一条消息 */
  const addMessage = useCallback((role: Message['role'], content: string) => {
    const msg: Message = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      role, content, timestamp: Date.now(),
    };
    setMessages(prev => [...prev, msg]);
    return msg;
  }, []);

  /** 更新最后一条 assistant 消息（流式追加） */
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

  // ── 创建 / 重建 AgentSession ──

  const ensureSession = useCallback(() => {
    if (sessionRef.current) return sessionRef.current;

    const session = createAgentSession({
      scenarioId: scenarioIdRef.current,
      userId,
      sessionId: sessionIdRef.current,
      memories: memoriesRef.current,
      summary: summaryRef.current,
      onEvent: (event: AgentEvent) => {
        switch (event.type) {
          case 'text':
            updateLastAssistant(event.content);
            break;

          case 'confirm_required':
            setConfirmRequest({
              tool: event.tool,
              label: event.label,
              form: event.form,
              fieldLabels: event.fieldLabels,
            });
            confirmToolRef.current = event.tool;
            setPhase('awaiting_confirm');
            setPhaseText(event.label || t('agent.pleaseConfirm'));
            break;

          case 'confirm_resolved':
            setConfirmRequest(null);
            confirmToolRef.current = '';
            setPhase('processing');
            setPhaseText(t('agent.processing'));
            break;

          case 'done':
            setPhase('done');
            setPhaseText(t('agent.done'));
            setConfirmRequest(null);
            confirmToolRef.current = '';
            break;

          case 'error':
            updateLastAssistant(t('agent.errorPrefix') + event.message);
            setPhase('error');
            setPhaseText(event.message);
            setError(event.message);
            break;

          case 'streaming':
            setIsStreaming(event.isStreaming);
            break;

          case 'content':
            setMessages(prev => {
              if (prev.length === 0) return prev;
              const last = prev[prev.length - 1];
              if (last.role !== 'assistant') return prev;
              return [...prev.slice(0, -1), { ...last, contentBlocks: event.blocks }];
            });
            break;
        }
      },
      onSummaryUpdate,
      onMemoriesExtracted,
    });

    sessionRef.current = session;
    return session;
  }, [userId, updateLastAssistant, t, onSummaryUpdate, onMemoriesExtracted]);

  // ── sendMessage: 发送用户消息 ──

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;

    setError(null);
    setConfirmRequest(null);
    confirmToolRef.current = '';
    addMessage('user', text);

    // 构建 history: 去掉 system 消息，取最近消息
    const history: SimpleMessage[] = messages
      .filter(m => m.role !== 'system')
      .slice(-20)
      .map(m => ({ role: m.role, content: m.content }));

    const allMessages: SimpleMessage[] = messages.map(m => ({ role: m.role, content: m.content }));

    addMessage('assistant', '');
    setPhase('processing');
    setPhaseText(t('agent.processing'));

    const session = ensureSession();
    messageCountRef.current = await session.sendMessage(text, history, allMessages, messageCountRef.current);
  }, [isStreaming, messages, addMessage, ensureSession, t]);

  // ── confirm: 处理 HITL 确认 ──

  const confirm = useCallback(async (approved: boolean) => {
    const tool = confirmToolRef.current;
    if (!tool && !confirmRequest) return;

    setConfirmRequest(null);
    const currentTool = confirmRequest?.tool || tool;
    confirmToolRef.current = '';

    const session = ensureSession();
    await session.confirm(approved, currentTool);

    addMessage('system', approved ? t('agent.confirmed') : t('agent.rejected'));
  }, [confirmRequest, addMessage, ensureSession, t]);

  // ── reset: 重置状态 ──

  const reset = useCallback(() => {
    sessionRef.current?.destroy();
    sessionRef.current = null;
    setMessages([]);
    setPhase('idle');
    setPhaseText(t('agent.enterRequest'));
    setConfirmRequest(null);
    setIsStreaming(false);
    setError(null);
    messageCountRef.current = 0;
    confirmToolRef.current = '';
  }, [t]);

  return {
    messages, phase, phaseText, confirmRequest,
    isStreaming, error,
    sendMessage, confirm, reset,
  };
}
