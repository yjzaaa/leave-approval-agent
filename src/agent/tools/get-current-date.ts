import { Type } from '@earendil-works/pi-ai';
import type { AgentTool } from '@earendil-works/pi-agent-core';

/**
 * 获取当前日期 Tool — 所有业务通用
 * 每次对话的第一步，确保 Agent 使用的是当前真实日期
 */
export const getCurrentDateTool: AgentTool<any> = {
  name: 'get_current_date',
  label: '获取当前日期',
  description: '获取当前日期和时间 YYYY-MM-DD HH:mm:ss。处理请求前必须调用。',
  parameters: Type.Object({}),
  execute: async () => {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 8);
    return {
      content: [{ type: 'text' as const, text: `${dateStr} ${timeStr}` }],
      details: null,
    };
  },
};
