/**
 * Agent 工厂 — 根据 Scenario 创建 Pi Agent
 *
 * 支持:
 *   - scenario.tools 自主定义
 *   - HITL 由 HitlManager 管理，confirmTools 自动包装
 *   - 用户记忆注入 system prompt
 *   - 对话摘要作为 history 前缀
 */
import { Agent } from '@earendil-works/pi-agent-core';
import { streamSimple, getModel } from '@earendil-works/pi-ai';
import type { Scenario } from '../../shared/scenario.js';
import type { ChatMessage } from '../../shared/types.js';
import type { MemoryItem } from '../../shared/memory.js';
import { HitlManager, wrapHitlTools } from '../hitl/hitl.js';
import { formatMemoriesForPrompt, formatSummaryForHistory } from '../memory/memory-prompt.js';
import type { ITracer } from '../tracing/mlflow-tracer.js';

export type SSECallback = (event: string, data: Record<string, unknown>) => void;

export interface AgentFactoryParams {
  scenario: Scenario;
  message: string;
  history?: ChatMessage[];
  onSSE: SSECallback;
  /** 用户记忆列表 (前端注入) */
  memories?: MemoryItem[];
  /** 对话摘要 (前端注入) */
  summary?: string;
  /** MLflow tracer（可选，启用时自动收集） */
  tracer?: ITracer;
  /** HITL 管理器创建回调 — 在 agent.prompt() 之前触发，用于注册到会话映射 */
  onHitlCreated?: (hitl: HitlManager) => void;
}

/** 获取默认模型 */
export function getDefaultModel() {
  return getModel('deepseek', 'deepseek-v4-pro' as any);
}

/** 获取字段标签映射 */
function getFieldLabels(scenario: Scenario): Record<string, string> {
  const map: Record<string, string> = {};
  if (scenario.fields) {
    for (const f of scenario.fields) { map[f.key] = f.label; }
  }
  return map;
}

/** 拼接 system prompt (场景 prompt + 用户记忆) */
function buildSystemPrompt(scenario: Scenario, memories?: MemoryItem[]): string {
  let prompt = scenario.systemPrompt;

  if (memories && memories.length > 0) {
    const memoryBlock = formatMemoriesForPrompt(memories);
    if (memoryBlock) {
      prompt = `${prompt}\n\n${memoryBlock}`;
    }
  }

  return prompt;
}

/** 构建初始消息列表 (摘要 + 历史) */
function buildInitialMessages(history: ChatMessage[], summary?: string): any[] {
  const messages: any[] = [];

  // 如果有摘要，作为 assistant 消息注入到最前面
  if (summary) {
    const summaryText = formatSummaryForHistory(summary);
    if (summaryText) {
      messages.push({
        role: 'assistant' as const,
        content: [{ type: 'text' as const, text: summaryText }],
        timestamp: Date.now(),
      });
    }
  }

  // 历史消息
  for (const m of history) {
    messages.push({
      role: m.role as 'user' | 'assistant',
      content: typeof m.content === 'string'
        ? [{ type: 'text' as const, text: m.content }]
        : m.content as any,
      timestamp: Date.now(),
    } as any);
  }

  return messages;
}

/** 创建并运行 Agent */
export async function runAgent(params: AgentFactoryParams): Promise<HitlManager> {
  const { scenario, message, history, onSSE, memories, summary, tracer, onHitlCreated } = params;

  const systemPrompt = buildSystemPrompt(scenario, memories);
  const initialMessages = buildInitialMessages(history || [], summary);
  const fieldLabels = getFieldLabels(scenario);

  // 创建 HITL 管理器，事件驱动 SSE（替代轮询）
  const hitl = new HitlManager({
    onEvent: (event) => {
      switch (event.type) {
        case 'confirm_required':
          tracer?.markHitl(event.tool);
          onSSE('confirm_required', {
            tool: event.tool,
            label: event.label ?? '📋 确认操作',
            form: scenario.formatFormForDisplay
              ? scenario.formatFormForDisplay(event.form as Record<string, string>)
              : event.form,
            fieldLabels,
          });
          break;
        case 'confirm_resolved':
          onSSE('confirm_resolved', { tool: event.tool });
          break;
      }
    },
  });

  // 自动包装 HITL tools（场景 tool 只含业务逻辑）
  const tools = wrapHitlTools(
    scenario.tools,
    hitl,
    scenario.confirmTools || [],
    scenario.confirmLabels,
  );

  // 立即注册 HitlManager（在 agent.prompt() 之前），消除 session 竞态
  onHitlCreated?.(hitl);

  const model = getDefaultModel();
  const agent = new Agent({
    initialState: {
      systemPrompt,
      tools,
      model,
      messages: initialMessages,
    },
    streamFn: streamSimple,
  });

  agent.subscribe(async (event, _signal) => {
    tracer?.handleEvent(event as any);

    switch (event.type) {
      case 'tool_execution_end':
        onSSE('tool_result', { tool: event.toolName, error: event.isError });
        break;
      case 'message_update': {
        const ev = event.assistantMessageEvent;
        if (ev.type === 'text_delta') {
          onSSE('text', { content: ev.delta });
        }
        break;
      }
      case 'message_end': break;
      case 'agent_end':
        onSSE('done', {});
        break;
    }
  });

  await agent.prompt(message);
  await agent.waitForIdle();

  return hitl;
}
