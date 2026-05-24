/**
 * 病假申请 — 场景入口
 */
import type { Scenario } from '../../shared/scenario.js';
import { allSickLeaveTools } from './tools.js';
import { sickLeaveFields } from './fields.js';
import { sickLeavePrompt } from './prompt.js';
import { validateSickLeaveForm } from './validator.js';
import { submitSickLeave, startSickLeaveProcess } from './api.js';

export const sickLeaveScenario: Scenario = {
  id: 'sick_leave',
  displayName: '病假申请',
  fields: sickLeaveFields,
  systemPrompt: sickLeavePrompt,
  tools: allSickLeaveTools,
  validate: validateSickLeaveForm,
  submitApi: submitSickLeave,
  startProcessApi: startSickLeaveProcess,
  suggestions: [
    '我发烧了需要请病假',
    '身体不适请 3 天病假',
    '急性肠胃炎需要休息',
  ],
  confirmTools: ['sick_leave_submit', 'sick_leave_start'],
  confirmLabels: {
    sick_leave_submit: '📋 确认病假信息',
    sick_leave_start: '🚀 确认发起病假审批',
  },
};
