/**
 * 远程办公审批 — 全部 Tool 定义
 *
 * HITL 由 HitlManager 在 agent-factory 中自动注入，tool 只定义业务逻辑。
 */
import { Type } from '@earendil-works/pi-ai';
import type { AgentTool } from '@earendil-works/pi-agent-core';
import { validateLeaveForm } from './validator.js';
import { submitLeaveForm, startLeaveProcess } from './api.js';

/** 获取当前日期 — 每次对话第一步 */
export const getCurrentDateTool: AgentTool = {
  name: 'get_current_date',
  label: '获取当前日期',
  description: '获取当前日期和时间。处理请求前必须调用。',
  parameters: Type.Object({}),
  execute: async () => {
    const now = new Date();
    return {
      content: [{ type: 'text' as const, text: `${now.toISOString().slice(0, 10)} ${now.toTimeString().slice(0, 8)}` }],
      details: null,
    };
  },
};

/** 校验远程办公表单 */
export const validateFormTool: AgentTool = {
  name: 'leave_approval_validate',
  label: '校验表单',
  description: '校验远程办公申请表，返回 { valid, errors[] }。',
  parameters: Type.Object({
    form: Type.Object({
      applicantName: Type.String(), department: Type.String(), employeeId: Type.String(),
      remoteStartDate: Type.String({ description: 'YYYY-MM-DD' }),
      remoteEndDate: Type.String({ description: 'YYYY-MM-DD' }),
      reason: Type.String(), workPlan: Type.String(),
      emergencyContact: Type.String(), address: Type.String(),
    }),
  }),
  execute: async (_id, params) => {
    const { form } = params as { form: Record<string, string> };
    const result = validateLeaveForm(form);
    return { content: [{ type: 'text' as const, text: JSON.stringify(result) }], details: result };
  },
};

/** 提交表单 — 需要用户确认 (HITL) */
export const submitFormTool: AgentTool = {
  name: 'leave_approval_submit',
  label: '提交表单',
  description: '提交远程办公申请表单，需要用户确认。',
  parameters: Type.Object({
    form: Type.Object({
      applicantName: Type.String(), department: Type.String(), employeeId: Type.String(),
      remoteStartDate: Type.String(), remoteEndDate: Type.String(),
      reason: Type.String(), workPlan: Type.String(),
      emergencyContact: Type.String(), address: Type.String(),
    }),
  }),
  execute: async (_id, params) => {
    const { form } = params as { form: Record<string, string> };
    const result = await submitLeaveForm(form);
    return { content: [{ type: 'text' as const, text: JSON.stringify(result) }], details: result };
  },
};

/** 发起审批流程 */
export const startProcessTool: AgentTool = {
  name: 'leave_approval_start',
  label: '发起流程',
  description: '发起远程办公审批流程，需要 resultId。',
  parameters: Type.Object({
    resultId: Type.String(),
    form: Type.Object({
      applicantName: Type.String(), department: Type.String(), employeeId: Type.String(),
      remoteStartDate: Type.String(), remoteEndDate: Type.String(),
      reason: Type.String(), workPlan: Type.String(),
      emergencyContact: Type.String(), address: Type.String(),
    }),
  }),
  execute: async (_id, params) => {
    const { resultId, form } = params as { resultId: string; form: Record<string, string> };
    const result = await startLeaveProcess(resultId, form);
    return { content: [{ type: 'text' as const, text: JSON.stringify(result) }], details: result };
  },
};

/** 全部 Tool 列表 */
export const allLeaveTools = [
  getCurrentDateTool,
  validateFormTool,
  submitFormTool,
  startProcessTool,
];