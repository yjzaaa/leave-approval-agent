/**
 * 病假申请 — 全部 Tool 定义
 */
import { Type } from '@earendil-works/pi-ai';
import type { AgentTool } from '@earendil-works/pi-agent-core';
import { requestConfirm } from '../../agent/confirm-state.js';
import { validateSickLeaveForm } from './validator.js';
import { submitSickLeave, startSickLeaveProcess } from './api.js';

export const getCurrentDateTool: AgentTool<any> = {
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

export const validateFormTool: AgentTool<any> = {
  name: 'sick_leave_validate',
  label: '校验病假表单',
  description: '校验病假申请表，返回 { valid, errors[] }。',
  parameters: Type.Object({
    form: Type.Object({
      applicantName: Type.String(), department: Type.String(), employeeId: Type.String(),
      startDate: Type.String({ description: 'YYYY-MM-DD' }),
      endDate: Type.String({ description: 'YYYY-MM-DD' }),
      diagnosis: Type.String({ description: '诊断/病因' }),
      doctorNote: Type.String({ description: '医生建议' }),
      hospital: Type.String({ description: '就诊医院(可选)' }),
      emergencyContact: Type.String(),
    }),
  }),
  execute: async (_id, params) => {
    const { form } = params as { form: any };
    const result = validateSickLeaveForm(form);
    return { content: [{ type: 'text' as const, text: JSON.stringify(result) }], details: result };
  },
};

export const submitFormTool: AgentTool<any> = {
  name: 'sick_leave_submit',
  label: '提交病假申请',
  description: '提交病假申请，需要用户确认。',
  parameters: Type.Object({
    form: Type.Object({
      applicantName: Type.String(), department: Type.String(), employeeId: Type.String(),
      startDate: Type.String(), endDate: Type.String(),
      diagnosis: Type.String(), doctorNote: Type.String(),
      hospital: Type.String(), emergencyContact: Type.String(),
    }),
  }),
  execute: async (_id, params) => {
    const { form } = params as { form: any };
    const approved = await requestConfirm('sick_leave_submit', form);
    if (!approved) throw new Error('用户拒绝提交病假申请');
    const result = await submitSickLeave(form);
    return { content: [{ type: 'text' as const, text: JSON.stringify(result) }], details: result };
  },
};

export const startProcessTool: AgentTool<any> = {
  name: 'sick_leave_start',
  label: '发起病假审批',
  description: '发起病假审批流程，需要用户确认。',
  parameters: Type.Object({
    resultId: Type.String(),
    form: Type.Object({
      applicantName: Type.String(), department: Type.String(), employeeId: Type.String(),
      startDate: Type.String(), endDate: Type.String(),
      diagnosis: Type.String(), doctorNote: Type.String(),
      hospital: Type.String(), emergencyContact: Type.String(),
    }),
  }),
  execute: async (_id, params) => {
    const { resultId, form } = params as { resultId: string; form: any };
    const approved = await requestConfirm('sick_leave_start', { resultId, form });
    if (!approved) throw new Error('用户拒绝发起病假审批');
    const result = await startSickLeaveProcess(resultId, form);
    return { content: [{ type: 'text' as const, text: JSON.stringify(result) }], details: result };
  },
};

export const allSickLeaveTools = [getCurrentDateTool, validateFormTool, submitFormTool, startProcessTool];