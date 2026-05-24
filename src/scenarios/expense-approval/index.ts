/**
 * 报销审批 — 场景入口
 */
import type { Scenario } from '../../shared/scenario.js';
import { allExpenseTools } from './tools.js';
import { expenseFields } from './fields.js';
import { expensePrompt } from './prompt.js';
import { validateExpenseForm } from './validator.js';
import { submitExpense, startExpenseProcess } from './api.js';

export const expenseScenario: Scenario = {
  id: 'expense_approval',
  displayName: '报销审批',
  fields: expenseFields,
  systemPrompt: expensePrompt,
  tools: allExpenseTools,
  validate: validateExpenseForm,
  submitApi: submitExpense,
  startProcessApi: startExpenseProcess,
  suggestions: [
    '我需要报销差旅费',
    '办公用品报销申请',
    '客户招待费用报销',
  ],
  confirmTools: ['expense_approval_submit', 'expense_approval_start'],
  confirmLabels: {
    expense_approval_submit: '📋 确认报销信息',
    expense_approval_start: '🚀 确认发起报销审批',
  },
};
