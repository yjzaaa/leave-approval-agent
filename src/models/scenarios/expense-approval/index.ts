/**
 * 报销审批 — 场景入口
 */
import type { Scenario } from '../../domain/interfaces/IScenario.js';
import type { ConfirmToolConfig } from '../../domain/interfaces/ConfirmToolConfig.js';
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
  confirmTools: [
    { name: 'expense_approval_submit', label: '📋 确认报销信息' },
    { name: 'expense_approval_start', label: '🚀 确认发起报销审批' },
  ] as ConfirmToolConfig[],
};
