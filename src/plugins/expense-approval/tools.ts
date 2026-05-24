/**
 * 报销审批 — 全部 Tool 定义
 *
 * HITL 由 HitlManager 在 agent-factory 中自动注入，tool 只定义业务逻辑。
 */
import { Type } from '@earendil-works/pi-ai';
import type { AgentTool } from '@earendil-works/pi-agent-core';
import { validateExpenseForm } from './validator.js';
import { submitExpense, startExpenseProcess } from './api.js';

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
  name: 'expense_approval_validate',
  label: '校验报销表单',
  description: '校验报销申请表，返回 { valid, errors[] }。',
  parameters: Type.Object({
    form: Type.Object({
      applicantName: Type.String(), department: Type.String(),
      amount: Type.String({ description: '报销金额(元)' }),
      category: Type.String({ description: '费用类别' }),
      expenseDate: Type.String({ description: 'YYYY-MM-DD' }),
      description: Type.String({ description: '费用说明' }),
      receiptUrl: Type.String({ description: '发票链接(可选)' }),
      remark: Type.String({ description: '备注(可选)' }),
    }),
  }),
  execute: async (_id, params) => {
    const { form } = params as { form: any };
    const result = validateExpenseForm(form);
    return { content: [{ type: 'text' as const, text: JSON.stringify(result) }], details: result };
  },
};

export const submitFormTool: AgentTool<any> = {
  name: 'expense_approval_submit',
  label: '提交报销',
  description: '提交报销申请，需要用户确认。',
  parameters: Type.Object({
    form: Type.Object({
      applicantName: Type.String(), department: Type.String(),
      amount: Type.String(), category: Type.String(),
      expenseDate: Type.String(), description: Type.String(),
      receiptUrl: Type.String(), remark: Type.String(),
    }),
  }),
  execute: async (_id, params) => {
    const { form } = params as { form: any };
    const result = await submitExpense(form);
    return { content: [{ type: 'text' as const, text: JSON.stringify(result) }], details: result };
  },
};

export const startProcessTool: AgentTool<any> = {
  name: 'expense_approval_start',
  label: '发起报销审批',
  description: '发起报销审批流程。',
  parameters: Type.Object({
    resultId: Type.String(),
    form: Type.Object({
      applicantName: Type.String(), department: Type.String(),
      amount: Type.String(), category: Type.String(),
      expenseDate: Type.String(), description: Type.String(),
      receiptUrl: Type.String(), remark: Type.String(),
    }),
  }),
  execute: async (_id, params) => {
    const { resultId, form } = params as { resultId: string; form: any };
    const result = await startExpenseProcess(resultId, form);
    return { content: [{ type: 'text' as const, text: JSON.stringify(result) }], details: result };
  },
};

export const allExpenseTools = [getCurrentDateTool, validateFormTool, submitFormTool, startProcessTool];