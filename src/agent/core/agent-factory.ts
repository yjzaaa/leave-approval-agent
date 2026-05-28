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
import type { AgentMessage } from '@earendil-works/pi-agent-core';
import { streamSimple } from '@earendil-works/pi-ai';
import type { Scenario } from '../../models/domain/interfaces/IScenario.js';
import type { ChatMessage } from '../../models/domain/models/ChatMessage.js';
import type { MemoryItem } from '../../models/domain/models/MemoryItem.js';
import { HitlManager } from '../hitl/index.js';
import { HitlSession } from '../hitl/index.js';
import { getModel } from '../model/index.js';
import { formatMemoriesForPrompt, formatSummaryForHistory, formatScenarioLearnings } from '../memory/memory-prompt.js';
import type { ITracer } from '../../models/domain/interfaces/ITracer.js';
import type { IAgentEventBus } from '../../models/domain/interfaces/IEventBus.js';

/** Agent 运行参数 */
export interface AgentRunParams {
  scenario: Scenario;
  message: string;
  history?: ChatMessage[];
  eventBus: IAgentEventBus;
  /** 用户记忆列表 (前端注入) */
  memories?: MemoryItem[];
  /** 对话摘要 (前端注入) */
  summary?: string;
  /** MLflow tracer（可选，启用时自动收集） */
  tracer?: ITracer;
  /** 模型实例（由外部注入，未传时走默认） */
  model?: ReturnType<typeof getModel>;
}

/** Agent 运行句柄 — 同步返回 HitlManager，异步等待完成 */
export interface AgentRun {
  /** HITL 管理器（立即可用，用于注册到会话映射） */
  hitl: HitlManager;
  /** Agent 运行完成 Promise */
  completed: Promise<void>;
}

/** 获取字段标签映射 */
function getFieldLabels(scenario: Scenario): Record<string, string> {
  const map: Record<string, string> = {};
  if (scenario.fields) {
    for (const f of scenario.fields) { map[f.key] = f.label; }
  }
  return map;
}

/** 拼接 system prompt (场景 prompt + 用户记忆 + 领域知识) */
function buildSystemPrompt(scenario: Scenario, memories?: MemoryItem[]): string {
  let prompt = scenario.systemPrompt;

  if (memories && memories.length > 0) {
    const memoryBlock = formatMemoriesForPrompt(memories);
    if (memoryBlock) {
      prompt = `${prompt}\n\n${memoryBlock}`;
    }

    const learningsBlock = formatScenarioLearnings(memories);
    if (learningsBlock) {
      prompt = `${prompt}\n\n${learningsBlock}`;
    }
  }

  return prompt;
}

/** 构建初始消息列表 (摘要 + 历史) */
function buildInitialMessages(history: ChatMessage[], summary?: string) {
  const messages: unknown[] = [];

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

  for (const m of history) {
    messages.push({
      role: m.role as 'user' | 'assistant',
      content: typeof m.content === 'string'
        ? [{ type: 'text' as const, text: m.content }]
        : m.content,
      timestamp: Date.now(),
    });
  }

  return messages;
}

/**
 * 创建并启动 Agent
 *
 * 同步返回 AgentRun 句柄，hitl 立即可用于注册到会话映射，
 * completed 是 Agent 运行完成的 Promise。
 */
export function startAgent(params: AgentRunParams): AgentRun {
  const { scenario, message, history, eventBus, memories, summary, tracer } = params;

  const systemPrompt = buildSystemPrompt(scenario, memories);
  const initialMessages = buildInitialMessages(history || [], summary);
  const hitlSession = new HitlSession(scenario, eventBus, getFieldLabels(scenario), tracer);

  const model = params.model || getModel('chat');
  const agent = new Agent({
    initialState: {
      systemPrompt,
      tools: hitlSession.tools,
      model,
      messages: initialMessages as AgentMessage[],
    },
    streamFn: streamSimple,
  });

  agent.subscribe(async (event, _signal) => {
    tracer?.handleEvent(event);

    switch (event.type) {
      case 'tool_execution_end':
        eventBus.emit('tool_result', { tool: event.toolName, error: event.isError ? String(event.isError) : undefined });
        // 提取 tool 结果中的 ContentBlock 并推送为 content SSE 事件
        if ((event.result as Record<string, unknown> | null)?.details &&
            (event.result as Record<string, unknown>).details &&
            ((event.result as Record<string, unknown>).details as Record<string, unknown>).blocks) {
          const detail = (event.result as Record<string, unknown>).details as Record<string, unknown>;
          eventBus.emit('content', { blocks: detail.blocks as Array<{ type: string; data: Record<string, unknown> }> });
        }
        break;
      case 'message_update': {
        const ev = event.assistantMessageEvent;
        if (ev.type === 'text_delta') {
          eventBus.emit('text', { content: ev.delta });
        }
        break;
      }
      case 'message_end': break;
      case 'agent_end':
        eventBus.emit('done', {});
        break;
    }
  });

  const completed = (async () => {
    await agent.prompt(message);
    await agent.waitForIdle();
  })();

  return { hitl: hitlSession.hitl, completed };
}
