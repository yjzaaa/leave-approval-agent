/**
 * 值班排班插件 — Tool 定义
 *
 * HITL 由 HitlManager 在 agent-factory 中自动注入，tool 只定义业务逻辑。
 */
import { Type } from '@earendil-works/pi-ai';
import type { AgentTool } from '@earendil-works/pi-agent-core';
import { querySchedule, submitSwapRequest } from './api.js';

/** 获取当前日期 */
export const getCurrentDateTool: AgentTool<any> = {
  name: 'get_current_date',
  label: '获取当前日期',
  description: '获取当前日期和时间。',
  parameters: Type.Object({}),
  execute: async () => {
    const now = new Date();
    return {
      content: [{ type: 'text' as const, text: `${now.toISOString().slice(0, 10)} ${now.toTimeString().slice(0, 8)}` }],
      details: null,
    };
  },
};

/** 查询排班 — 无需 HITL */
export const queryScheduleTool: AgentTool<any> = {
  name: 'oncall_query',
  label: '查询排班',
  description: '查询指定日期的值班排班信息。返回值班人员、部门、班次。',
  parameters: Type.Object({
    date: Type.String({ description: '查询日期 YYYY-MM-DD' }),
    department: Type.String({ description: '部门筛选（可选）' }),
  }),
  execute: async (_id, params) => {
    const { date, department } = params as { date: string; department?: string };
    const result = await querySchedule(date, department);
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result) }],
      details: result,
    };
  },
};

/** 换班申请 — 单步 HITL (只有提交时确认) */
export const submitSwapTool: AgentTool<any> = {
  name: 'oncall_swap',
  label: '换班申请',
  description: '提交换班申请，需要用户确认。',
  parameters: Type.Object({
    requester: Type.String({ description: '申请人姓名' }),
    targetDate: Type.String({ description: '目标日期 YYYY-MM-DD' }),
    targetShift: Type.String({ description: '目标班次' }),
    reason: Type.String({ description: '换班原因' }),
  }),
  execute: async (_id, params) => {
    const { requester, targetDate, targetShift, reason } = params as {
      requester: string; targetDate: string; targetShift: string; reason: string;
    };
    const result = await submitSwapRequest(requester, targetDate, targetShift, reason);
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result) }],
      details: result,
    };
  },
};

export const allOncallTools = [getCurrentDateTool, queryScheduleTool, submitSwapTool];