/**
 * AgentSession — 纯业务编排逻辑（不依赖 React）
 *
 * 核心职责:
 *   1. SSE 流式对话管理（server 模式）/ 直接 Agent 调用（local 模式）
 *   2. HITL 确认流程
 *   3. 阶段追踪
 *   4. 记忆注入 — 把用户记忆和对话摘要传给后端/Agent
 *   5. 压缩触发 — 消息数超阈值时执行对话压缩
 *
 * 设计原则:
 *   - 零 React 依赖，所有状态变化通过 onEvent 回调通知外部
 *   - 可被 React Hook、CLI、测试等任意宿主使用
 */
import type { MemoryItem } from '../../models/domain/models/MemoryItem';
import { MEMORY_LIMITS } from '../../infrastructure/constants/memory';

/** 非 "server" 模式均视为 local */
const isLocal = import.meta.env.MODE !== 'server';

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
  | { type: 'streaming'; isStreaming: boolean };

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
  /** 是否 local 模式 */
  isLocal: boolean;
  /** 用户记忆 */
  memories: MemoryItem[];
  /** 对话摘要 */
  summary: string;
  /** 事件回调 — 所有状态变化通过此回调通知外部 */
  onEvent: (event: AgentEvent) => void;
  /** 对话压缩完成回调 */
  onSummaryUpdate?: (summary: string, messageCount: number) => void;
  /** 记忆提取完成回调 */
  onMemoriesExtracted?: (memories: { user: string[]; feedback: string[]; project: string[]; reference: string[] }) => void;
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
  } = options;

  let abortController: AbortController | null = null;
  let hitlHandle: { approve: () => boolean; reject: () => boolean } | null = null;
  let lastConfirmTool: string | null = null;

  // ── 压缩对话历史（server 模式: HTTP; local 模式: 进程内） ──

  const compactHistory = async (oldMessages: SimpleMessage[]) => {
    if (oldMessages.length < MEMORY_LIMITS.compactThreshold) return;
    try {
      let result: string | null = null;

      if (isLocal) {
        const { compactHistoryLocal } = await import('../../agent/local/local-utils.js');
        result = await compactHistoryLocal(oldMessages);
      } else {
        const res = await fetch('/api/compact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: oldMessages,
            scenario: scenarioId,
          }),
        });
        const data = await res.json();
        result = data.summary || null;
      }

      if (result && onSummaryUpdate) {
        onSummaryUpdate(result, oldMessages.length);
      }
    } catch { /* 压缩失败不影响主流程 */ }
  };

  // ── 提取记忆（server 模式: HTTP; local 模式: 进程内） ──

  const extractMemories = async (recentMessages: SimpleMessage[]) => {
    if (!onMemoriesExtracted) return;
    try {
      if (isLocal) {
        const { extractMemoriesLocal } = await import('../../agent/local/local-utils.js');
        const data = await extractMemoriesLocal(recentMessages);
        onMemoriesExtracted(data);
      } else {
        const res = await fetch('/api/extract-memories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: recentMessages,
            scenario: scenarioId,
          }),
        });
        const data = await res.json();
        if (data && onMemoriesExtracted) {
          onMemoriesExtracted(data);
        }
      }
    } catch { /* 提取失败不影响主流程 */ }
  };

  // ── 处理 local 模式的 SSE 事件 ──

  const handleLocalSSE = (fullText: { value: string }, event: string, data: Record<string, unknown>) => {
    switch (event) {
      case 'text':
        fullText.value += data.content as string;
        onEvent({ type: 'text', content: fullText.value });
        break;

      case 'confirm_required':
        if (lastConfirmTool === data.tool) break;
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

      case 'tool_result':
        break;

      case 'done':
        onEvent({ type: 'done' });
        lastConfirmTool = null;
        break;

      case 'error':
        onEvent({ type: 'error', message: data.message as string });
        break;
    }
  };

  // ── 处理 server 模式的 SSE 事件 ──

  const handleServerSSE = (fullText: { value: string }, eventType: string, data: Record<string, unknown>) => {
    switch (eventType) {
      case 'text':
        fullText.value += data.content;
        onEvent({ type: 'text', content: fullText.value });
        break;

      case 'confirm_required':
        if (lastConfirmTool === data.tool) {
          console.log('[SSE] confirm_required ignored: duplicate');
          break;
        }
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

      case 'tool_result':
        break;

      case 'done':
        onEvent({ type: 'done' });
        lastConfirmTool = null;
        break;

      case 'error':
        onEvent({ type: 'error', message: data.message as string });
        break;
    }
  };

  // ── sendMessage: 发送用户消息 ──

  const sendMessage = async (text: string, history: SimpleMessage[], allMessages: SimpleMessage[], messageCount: number): Promise<number> => {
    let newMessageCount = messageCount + 1;

    onEvent({ type: 'streaming', isStreaming: true });
    lastConfirmTool = null;

    // 触发记忆提取 (每 N 轮)
    if (newMessageCount > 0 && newMessageCount % MEMORY_LIMITS.extractInterval === 0) {
      extractMemories(allMessages.slice(-10));
    }

    // 检查是否需要压缩
    if (allMessages.length >= MEMORY_LIMITS.compactThreshold) {
      compactHistory(allMessages.slice(0, -8));
    }

    // ── Local 模式：直接调用 runAgent ──
    if (isLocal) {
      const fullText = { value: '' };

      try {
        const [{ runAgent }, { getScenario }, { createTracer }] = await Promise.all([
          import('../../agent/core/agent-factory.js'),
          import('../../models/scenarios/registry.js'),
          import('../../agent/tracing/mlflow-tracer.js'),
        ]);

        const scenario = getScenario(scenarioId);

        const tracer = createTracer({
          scenario: scenario.id,
          userId: userId,
          sessionId: `local-${Date.now()}`,
          message: text,
        });

        await tracer.run(async () => {
          return runAgent({
            scenario,
            message: text,
            history,
            memories,
            summary,
            onSSE: (event: string, data: Record<string, unknown>) => {
              handleLocalSSE(fullText, event, data);
            },
            onHitlCreated: (h: { approve: () => boolean; reject: () => boolean }) => {
              hitlHandle = h;
            },
            tracer,
          });
        });
      } catch (err: unknown) {
        // 用户拒绝 HITL 也会抛错，这是正常流程，不显示错误
        if (err instanceof Error && err.message?.includes('用户拒绝')) {
          onEvent({ type: 'done' });
        } else {
          const errMsg = err instanceof Error ? err.message : String(err);
          onEvent({ type: 'error', message: errMsg });
        }
      } finally {
        onEvent({ type: 'streaming', isStreaming: false });
        hitlHandle = null;
      }

      return newMessageCount;
    }

    // ── Server 模式：SSE over HTTP ──
    const controller = new AbortController();
    abortController = controller;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history,
          scenario: scenarioId,
          memories,
          summary,
          userId,
          sessionId,
        }),
        signal: controller.signal,
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const fullText = { value: '' };

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
            handleServerSSE(fullText, eventType, data);
          } catch { /* 跳过解析失败 */ }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        onEvent({ type: 'error', message: err.message });
      }
    } finally {
      onEvent({ type: 'streaming', isStreaming: false });
      abortController = null;
    }

    return newMessageCount;
  };

  // ── confirm: 处理 HITL 确认 ──

  const confirm = async (approved: boolean, tool: string) => {
    lastConfirmTool = tool;

    // Local 模式：直接操作 HitlManager
    if (isLocal && hitlHandle) {
      if (approved) {
        hitlHandle.approve();
      } else {
        hitlHandle.reject();
      }
      return;
    }

    // Server 模式：POST /api/confirm
    try {
      await fetch('/api/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved, sessionId }),
      });
    } catch { /* 忽略 */ }
  };

  // ── destroy: 清理资源 ──

  const destroy = () => {
    abortController?.abort();
    abortController = null;
    hitlHandle = null;
    lastConfirmTool = null;
  };

  return {
    sendMessage,
    confirm,
    destroy,
  };
}
