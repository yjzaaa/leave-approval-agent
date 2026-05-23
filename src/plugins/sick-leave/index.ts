/**
 * 病假申请 — 插件入口
 */
import type { BusinessPlugin } from '../../shared/plugin.js';
import { sickLeaveFields } from './fields.js';
import { sickLeavePrompt } from './prompt.js';
import { validateSickLeaveForm } from './validator.js';
import { submitSickLeave, startSickLeaveProcess } from './api.js';

export const sickLeavePlugin: BusinessPlugin = {
  id: 'sick_leave',
  displayName: '病假申请',
  fields: sickLeaveFields,
  systemPrompt: sickLeavePrompt,
  tools: [] as any,
  validate: validateSickLeaveForm,
  submitApi: submitSickLeave,
  startProcessApi: startSickLeaveProcess,
  confirmLabels: {
    submit: '📋 确认病假信息',
    start: '🚀 确认发起病假审批',
  },
};
