/**
 * 病假申请 — 场景入口
 */
import type { Scenario } from '../../domain/interfaces/IScenario.js';
import type { ConfirmToolConfig } from '../../domain/interfaces/ConfirmToolConfig.js';
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
  confirmTools: [
    { name: 'sick_leave_submit', label: '📋 确认病假信息' },
    { name: 'sick_leave_start', label: '🚀 确认发起病假审批' },
  ] as ConfirmToolConfig[],
};
