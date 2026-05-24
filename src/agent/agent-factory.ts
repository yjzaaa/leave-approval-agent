/**
 * Agent 工厂 — 根据 BusinessPlugin 创建 Pi Agent
 *
 * 支持:
 *   - plugin.tools 自主定义
 *   - HITL 由 confirmTools 决定
 *   - 用户记忆注入 system prompt
 *   - 对话摘要作为 history 前缀
 */
import { Agent } from '@earendil-works/pi-agent-core';
import { streamSimple, getModel } from '@earendil-works/pi-ai';
import type { BusinessPlugin } from '../shared/plugin.js';
import type { ChatMessage } from '../shared/types.js';
import type { MemoryItem } from '../shared/memory.js';
import { getPending } from './confirm-state.js';
import { formatMemoriesForPrompt, formatSummaryForHistory } from './memory-prompt.js';
import { traceSpan } from './mlflow-tracer.js';

export type SSECallback = (event: string, data: Record<string, unknown>) => void;

export interface AgentFactoryParams {
  plugin: BusinessPlugin;
  message: string;
  history?: ChatMessage[];
  onSSE: SSECallback;
  /** 用户记忆列表 (前端注入) */
  memories?: MemoryItem[];
  /** 对话摘要 (前端注入) */
  summary?: string;
}

/** 获取默认模型 */
export function getDefaultModel() {
  return getModel('deepseek', 'deepseek-v4-pro' as any);
}

/** 判断某 tool 是否需要 HITL (由 plugin.confirmTools 决定) */
function isConfirmTool(toolName: string, plugin: BusinessPlugin): boolean {
  const tools = plugin.confirmTools || [];
  return tools.includes(toolName);
}

/** 获取确认文案 */
function getConfirmLabel(toolName: string, plugin: BusinessPlugin): string {
  if (plugin.confirmLabels && plugin.confirmLabels[toolName]) {
    return plugin.confirmLabels[toolName];
  }
  return '📋 确认操作';
}

/** 获取字段标签映射 */
function getFieldLabels(plugin: BusinessPlugin): Record<string, string> {
  const map: Record<string, string> = {};
  if (plugin.fields) {
    for (const f of plugin.fields) { map[f.key] = f.label; }
  }
  return map;
}

/** 拼接 system prompt (插件 prompt + 用户记忆) */
function buildSystemPrompt(plugin: BusinessPlugin, memories?: MemoryItem[]): string {
  let prompt = plugin.systemPrompt;

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
export async function runAgent(params: AgentFactoryParams): Promise<void> {
  const { plugin, message, history, onSSE, memories, summary } = params;

  const systemPrompt = buildSystemPrompt(plugin, memories);
  const initialMessages = buildInitialMessages(history || [], summary);

  const model = getDefaultModel();
  const agent = new Agent({
    initialState: {
      systemPrompt,
      tools: plugin.tools,
      model,
      messages: initialMessages,
    },
    streamFn: streamSimple,
  });

  let confirmTick: ReturnType<typeof setInterval> | null = null;

  agent.subscribe(async (event, _signal) => {
    switch (event.type) {
      case 'tool_execution_start': {
        traceSpan(`tool:${event.toolName}`, {
          'tool.name': event.toolName,
          'tool.confirm': isConfirmTool(event.toolName, plugin),
        }, async () => {}).catch(() => {});
        if (isConfirmTool(event.toolName, plugin)) {
          const tevent = event as any;
          const form = tevent.args?.form || {};
          confirmTick = setInterval(() => {
            if (!getPending()) {
              if (confirmTick) { clearInterval(confirmTick); confirmTick = null; }
              onSSE('confirm_resolved', { tool: event.toolName });
            }
          }, 200);
          onSSE('confirm_required', {
            tool: event.toolName,
            label: getConfirmLabel(event.toolName, plugin),
            form: plugin.formatFormForDisplay ? plugin.formatFormForDisplay(form) : form,
            fieldLabels: getFieldLabels(plugin),
          });
        }
        break;
      }
      case 'tool_execution_end':
        traceSpan(`tool:${event.toolName}`, {
          'tool.error': event.isError ?? false,
        }, async () => {}).catch(() => {});
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
        if (confirmTick) clearInterval(confirmTick);
        onSSE('done', {});
        break;
    }
  });

  await agent.prompt(message);
  await agent.waitForIdle();
}