/**
 * Agent 工厂 — 根据 BusinessPlugin 创建完整的 Pi Agent 实例
 *
 * 职责：
 * 1. 加载插件 → 组装 System Prompt + Tools
 * 2. 创建 Agent 实例
 * 3. 订阅 Agent 事件 → 转换为通用 SSE 事件流
 * 4. 处理 Human-in-the-Loop 确认循环
 *
 * 调用方（server/index.ts）通过 onSSE 回调接收标准化事件，
 * 无需关心具体的 tool 名称或业务逻辑。
 */
import { Agent } from '@earendil-works/pi-agent-core';
import { streamSimple, getModel } from '@earendil-works/pi-ai';
import type { BusinessPlugin } from '../shared/plugin.js';
import type { ChatMessage } from '../shared/types.js';
import { getCurrentDateTool } from './tools/get-current-date.js';
import { createValidateTool } from './tools/validate-form.js';
import { createSubmitTool } from './tools/submit-form.js';
import { createStartProcessTool } from './tools/start-process.js';
import { getPending } from './confirm-state.js';

/**
 * SSE 事件回调类型
 */
export type SSECallback = (event: string, data: Record<string, unknown>) => void;

/**
 * Agent 工厂参数
 */
export interface AgentFactoryParams {
  plugin: BusinessPlugin;
  message: string;
  history?: ChatMessage[];
  onSSE: SSECallback;
}

/**
 * 获取默认模型配置
 */
export function getDefaultModel() {
  return getModel('deepseek', 'deepseek-v4-pro' as any);
}

/**
 * 根据插件动态组装 Tool 列表
 *
 * 每个插件都获得一套完整的工具链：
 *   通用: getCurrentDateTool
 *   工厂: validateTool / submitTool / startProcessTool
 *
 * Tool 命名规则: {pluginId}_{action}
 *   例: leave_approval_validate, leave_approval_submit, leave_approval_start
 */
function buildTools(plugin: BusinessPlugin) {
  return [
    getCurrentDateTool,
    createValidateTool(plugin),
    createSubmitTool(plugin),
    createStartProcessTool(plugin),
  ];
}

/**
 * 确认类 Tool 名称集合（用于 SSE 层判断是否需要 confirm_required）
 */
function isConfirmTool(toolName: string, plugin: BusinessPlugin): boolean {
  return toolName === `${plugin.id}_submit` || toolName === `${plugin.id}_start`;
}

/**
 * 获取确认阶段文案
 */
function getConfirmLabel(toolName: string, plugin: BusinessPlugin): string {
  return toolName === `${plugin.id}_submit`
    ? plugin.confirmLabels?.submit || `📋 确认提交${plugin.displayName}`
    : plugin.confirmLabels?.start || `🚀 确认发起${plugin.displayName}流程`;
}

/**
 * 获取字段标签映射（用于前端 ConfirmCard 展示）
 */
function getFieldLabels(plugin: BusinessPlugin): Record<string, string> {
  const map: Record<string, string> = {};
  for (const f of plugin.fields) {
    map[f.key] = f.label;
  }
  return map;
}

/**
 * 创建并运行 Agent
 *
 * 流程图：
 *   初始化 → prompt(message) → 事件循环 → waitForIdle() → 完成
 *
 * SSE 事件流：
 *   text            — 流式文本增量
 *   tool_result     — Tool 执行结果（阶段切换）
 *   confirm_required — 需要用户确认
 *   confirm_resolved — 确认已处理
 *   done            — 流程结束
 *   error           — 错误
 */
export async function runAgent(params: AgentFactoryParams): Promise<void> {
  const { plugin, message, history, onSSE } = params;

  // ── 转换历史消息格式 ──
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
      tools: buildTools(plugin),
      model,
      messages: initialMessages,
    },
    streamFn: streamSimple,
  });

  // ── 确认轮询定时器 ──
  let confirmTick: ReturnType<typeof setInterval> | null = null;

  // ── 订阅 Agent 事件 → 转为 SSE ──
  agent.subscribe(async (event, _signal) => {
    // 调试日志
    if (event.type === 'tool_execution_start' || event.type === 'tool_execution_end') {
      const ev = event as any;
      console.log(`[Agent] ${event.type}: ${ev.toolName} | args keys:`, ev.args ? Object.keys(ev.args) : 'none');
    } else if (event.type !== 'message_update') {
      console.log(`[Agent] ${event.type}`);
    }

    switch (event.type) {
      // ── Tool 开始执行 ──
      case 'tool_execution_start': {
        if (isConfirmTool(event.toolName, plugin)) {
          const tevent = event as any;
          const form = tevent.args?.form || {};

          // 启动轮询，检测 confirm-state 是否 resolve
          confirmTick = setInterval(() => {
            if (!getPending()) {
              if (confirmTick) { clearInterval(confirmTick); confirmTick = null; }
              onSSE('confirm_resolved', { tool: event.toolName });
            }
          }, 200);

          // 推送确认请求
          onSSE('confirm_required', {
            tool: event.toolName,
            label: getConfirmLabel(event.toolName, plugin),
            form: plugin.formatFormForDisplay ? plugin.formatFormForDisplay(form) : form,
            fieldLabels: getFieldLabels(plugin),
          });
          console.log(`  → SSE confirm_required: ${event.toolName}`);
        }
        break;
      }

      // ── Tool 执行结束 ──
      case 'tool_execution_end':
        if (!isConfirmTool(event.toolName, plugin)) {
          onSSE('tool_result', {
            tool: event.toolName,
            error: event.isError,
          });
        }
        break;

      // ── 流式文本 ──
      case 'message_update': {
        const ev = event.assistantMessageEvent;
        if (ev.type === 'text_delta') {
          onSSE('text', { content: ev.delta });
        }
        break;
      }

      case 'message_end':
        break;

      // ── Agent 结束 ──
      case 'agent_end':
        if (confirmTick) clearInterval(confirmTick);
        onSSE('done', {});
        break;
    }
  });

  // ── 执行 ──
  await agent.prompt(message);
  await agent.waitForIdle();
}
