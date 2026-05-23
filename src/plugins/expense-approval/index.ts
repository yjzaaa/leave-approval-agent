/**
 * 报销审批 — 插件入口
 */
import type { BusinessPlugin } from '../../shared/plugin.js';
import { expenseFields } from './fields.js';
import { expensePrompt } from './prompt.js';
import { validateExpenseForm } from './validator.js';
import { submitExpense, startExpenseProcess } from './api.js';

export const expensePlugin: BusinessPlugin = {
  id: 'expense_approval',
  displayName: '报销审批',
  fields: expenseFields,
  systemPrompt: expensePrompt,
  tools: [] as any,
  validate: validateExpenseForm,
  submitApi: submitExpense,
  startProcessApi: startExpenseProcess,
  confirmLabels: {
    submit: '📋 确认报销信息',
    start: '🚀 确认发起报销审批',
  },
};
