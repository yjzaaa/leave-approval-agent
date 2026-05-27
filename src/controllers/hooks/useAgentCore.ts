/**
 * AgentSession — 纯业务编排逻辑（不依赖 React）
 *
 * 核心职责:
 *   1. SSE 流式对话管理（通过 Express 路由）
 *   2. HITL 确认流程
 *   3. 阶段追踪
 *   4. 记忆注入 — 把用户记忆和对话摘要传给后端
 *   5. 压缩触发 — 消息数超阈值时执行对话压缩
 *
 * 设计原则:
 *   - 零 React 依赖，所有状态变化通过 onEvent 回调通知外部
 *   - 可被 React Hook、CLI、测试等任意宿主使用
 *   - 前端通过 infrastructure/api 与后端通信，不直接使用 fetch
 */
import type { MemoryItem } from '../../models/domain/models/MemoryItem';
import { MEMORY_LIMITS } from '../../infrastructure/constants/memory';
import { api, createSSEStream } from '../../infrastructure/api/index.js';
import type { SSEStream } from '../../infrastructure/api/index.js';

// ══════════════════════════════════════════════
// 事件类型定义
// ══════════════════════════════════════════════

/** Agent 事件 — 所有状态变化通过此联合类型通知外部 */
export type AgentEvent =
  | { type: 'text'; content: string }
  | { type: 'confirm_required'; tool: string; label: string; form: Record<string, string>; fieldLabels: Record<string, string> }
  | { type: 'confirm_resolved' }
  | { type: 'done' }
  | { type: 'error'; message: string }
  | { type: 'streaming'; isStreaming: boolean }
  | { type: 'content'; blocks: Array<{ type: string; data: Record<string, unknown> }> };

/** 简化消息结构（不包含 UI 层 id/timestamp 等字段） */
export interface SimpleMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// ══════════════════════════════════════════════
// AgentSession 配置与接口
// ══════════════════════════════════════════════

/** AgentSession 创建选项 */
export interface AgentSessionOptions {
  /** 场景 ID */
  scenarioId: string;
  /** 用户 ID */
  userId?: string;
  /** 会话 ID（页面加载时生成，同一会话内所有请求共用） */
  sessionId: string;
  /** 用户记忆 */
  memories: MemoryItem[];
  /** 对话摘要 */
  summary: string;
  /** 事件回调 — 所有状态变化通过此回调通知外部 */
  onEvent: (event: AgentEvent) => void;
  /** 对话压缩完成回调 */
  onSummaryUpdate?: (summary: string, messageCount: number) => void;
  /** 记忆提取完成回调 */
  onMemoriesExtracted?: (memories: { user: string[]; feedback: string[]; project: string[]; reference: string[]; learnings: string[] }) => void;
  /** 已有的领域知识（传入提取 prompt 用于迭代合并） */
  existingLearnings?: string[];
}

/** Agent 会话接口 — 封装单次会话的完整生命周期 */
export interface AgentSession {
  /** 发送用户消息 */
  sendMessage(text: string, history: SimpleMessage[], allMessages: SimpleMessage[], messageCount: number): Promise<number>;
  /** 处理 HITL 确认 @param approved 是否批准 @param tool 触发确认的 tool 名称（用于去重） */
  confirm(approved: boolean, tool: string): Promise<void>;
  /** 销毁会话，清理资源 */
  destroy(): void;
}

// ══════════════════════════════════════════════
// SSE 事件处理
// ══════════════════════════════════════════════

/** 处理 SSE 事件 */
const handleSSE = (
  fullText: { value: string },
  eventType: string,
  data: Record<string, unknown>,
  onEvent: (event: AgentEvent) => void,
  lastConfirmTool: { value: string | null },
) => {
  switch (eventType) {
    case 'text':
      fullText.value += data.content as string;
      onEvent({ type: 'text', content: fullText.value });
      break;

    case 'confirm_required':
      if (lastConfirmTool.value === data.tool) break;
      onEvent({
        type: 'confirm_required',
        tool: data.tool as string,
        label: data.label as string,
        form: data.form as Record<string, string>,
        fieldLabels: data.fieldLabels as Record<string, string>,
      });
      break;

    case 'confirm_resolved':
      onEvent({ type: 'confirm_resolved' });
      break;

    case 'content':
      onEvent({ type: 'content', blocks: data.blocks as Array<{ type: string; data: Record<string, unknown> }> });
      break;

    case 'tool_result':
      break;

    case 'done':
      onEvent({ type: 'done' });
      lastConfirmTool.value = null;
      break;

    case 'error':
      onEvent({ type: 'error', message: data.message as string });
      break;
  }
};

// ══════════════════════════════════════════════
// AgentSession 实现
// ══════════════════════════════════════════════

/**
 * 创建 AgentSession 实例
 *
 * @param options 会话配置
 * @returns AgentSession 实例
 */
export function createAgentSession(options: AgentSessionOptions): AgentSession {
  const {
    scenarioId,
    userId,
    sessionId,
    memories,
    summary,
    onEvent,
    onSummaryUpdate,
    onMemoriesExtracted,
    existingLearnings,
  } = options;

  let activeStream: SSEStream | null = null;
  let lastConfirmTool: { value: string | null } = { value: null };

  // ── 压缩对话历史（通过 axios POST） ──

  const compactHistory = async (oldMessages: SimpleMessage[]) => {
    if (oldMessages.length < MEMORY_LIMITS.compactThreshold) return;
    try {
      const { data } = await api.post('/compact', {
        messages: oldMessages,
        scenario: scenarioId,
      });
      if (data.summary && onSummaryUpdate) {
        onSummaryUpdate(data.summary, oldMessages.length);
      }
    } catch { /* 压缩失败不影响主流程 */ }
  };

  // ── 提取记忆（通过 axios POST） ──

  const extractMemories = async (recentMessages: SimpleMessage[]) => {
    if (!onMemoriesExtracted) return;
    try {
      const { data } = await api.post('/extract-memories', {
        messages: recentMessages,
        scenario: scenarioId,
        existingLearnings,
      });
      if (data) {
        onMemoriesExtracted(data);
      }
    } catch { /* 提取失败不影响主流程 */ }
  };

  // ── sendMessage: 发送用户消息 ──

  const sendMessage = async (text: string, history: SimpleMessage[], allMessages: SimpleMessage[], messageCount: number): Promise<number> => {
    let newMessageCount = messageCount + 1;

    onEvent({ type: 'streaming', isStreaming: true });
    lastConfirmTool.value = null;

    // 触发记忆提取 (每 N 轮)
    if (newMessageCount > 0 && newMessageCount % MEMORY_LIMITS.extractInterval === 0) {
      extractMemories(allMessages.slice(-10));
    }

    // 检查是否需要压缩
    if (allMessages.length >= MEMORY_LIMITS.compactThreshold) {
      compactHistory(allMessages.slice(0, -8));
    }

    // ── SSE 流式请求 ──
    const stream = createSSEStream({
      url: '/api/chat',
      body: {
        message: text,
        history,
        scenario: scenarioId,
        memories,
        summary,
        userId,
        sessionId,
      },
    });
    activeStream = stream;

    const fullText = { value: '' };

    await stream.read({
      onEvent: (eventType, data) => {
        if (eventType !== 'text') {
          console.log('[SSE] event:', eventType, JSON.stringify(data).slice(0, 100));
        }
        handleSSE(fullText, eventType, data, onEvent, lastConfirmTool);
      },
      onError: (err) => {
        onEvent({ type: 'error', message: err.message });
      },
    });

    onEvent({ type: 'streaming', isStreaming: false });
    activeStream = null;

    return newMessageCount;
  };

  // ── confirm: 处理 HITL 确认 ──

  const confirm = async (approved: boolean, tool: string) => {
    lastConfirmTool.value = tool;

    try {
      await api.post('/confirm', { approved, sessionId });
    } catch { /* 忽略 */ }
  };

  // ── destroy: 清理资源 ──

  const destroy = () => {
    activeStream?.abort();
    activeStream = null;
    lastConfirmTool.value = null;
  };

  return {
    sendMessage,
    confirm,
    destroy,
  };
}
