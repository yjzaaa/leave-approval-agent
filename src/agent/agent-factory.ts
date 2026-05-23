/**
 * Agent 工厂 — 根据 BusinessPlugin 创建 Pi Agent
 *
 * 框架层不定义任何 tool。
 * tool 完全由 plugin.tools 提供。
 * HITL: 框架只提供 confirm-state 状态机 + SSE 事件转换。
 */
import { Agent } from '@earendil-works/pi-agent-core';
import { streamSimple, getModel } from '@earendil-works/pi-ai';
import type { BusinessPlugin } from '../shared/plugin.js';
import type { ChatMessage } from '../shared/types.js';
import { getPending } from './confirm-state.js';

export type SSECallback = (event: string, data: Record<string, unknown>) => void;

export interface AgentFactoryParams {
  plugin: BusinessPlugin;
  message: string;
  history?: ChatMessage[];
  onSSE: SSECallback;
}

/** 获取默认模型 */
export function getDefaultModel() {
  return getModel('deepseek', 'deepseek-v4-pro' as any);
}

/** 判断某 tool 是否需要 HITL（由 plugin.confirmTools 决定） */
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

/** 创建并运行 Agent */
export async function runAgent(params: AgentFactoryParams): Promise<void> {
  const { plugin, message, history, onSSE } = params;

  const initialMessages = (history || []).map(m => ({
    role: m.role as 'user' | 'assistant',
    content: typeof m.content === 'string'
      ? [{ type: 'text' as const, text: m.content }]
      : m.content as any,
    timestamp: Date.now(),
  } as any));

  const model = getDefaultModel();
  const agent = new Agent({
    initialState: {
      systemPrompt: plugin.systemPrompt,
      tools: plugin.tools,  // ★ 直接使用插件提供的 tools，框架不参与定义
      model,
      messages: initialMessages,
    },
    streamFn: streamSimple,
  });

  let confirmTick: ReturnType<typeof setInterval> | null = null;

  agent.subscribe(async (event, _signal) => {
    switch (event.type) {
      case 'tool_execution_start': {
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
        onSSE('tool_result', { tool: event.toolName, error: event.isError });
        break;
      case 'message_update': {
        const ev = event.assistantMessageEvent;
        if (ev.type === 'text_delta') onSSE('text', { content: ev.delta });
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