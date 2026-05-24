/**
 * 远程办公审批 — 场景入口
 *
 * 导出一个完整的 Scenario 实例，包含：
 *   - 表单字段定义
 *   - System Prompt
 *   - 表单校验
 *   - Mock API
 *
 * 注册到 registry 后即可被 Agent 框架加载。
 */
import type { Scenario } from '../../shared/scenario.js';
import { allLeaveTools } from './tools.js';
import { leaveFields } from './fields.js';
import { leavePrompt } from './prompt.js';
import { validateLeaveForm } from './validator.js';
import { submitLeaveForm, startLeaveProcess } from './api.js';

export const leaveScenario: Scenario = {
  id: 'leave_approval',
  displayName: '远程办公审批',
  fields: leaveFields,
  systemPrompt: leavePrompt,
  tools: allLeaveTools,
  validate: validateLeaveForm,
  submitApi: submitLeaveForm,
  startProcessApi: startLeaveProcess,
  suggestions: [
    '我需要申请远程办公',
    '家人住院需要照顾',
    '身体不适在家办公',
  ],
  confirmTools: ['leave_approval_submit', 'leave_approval_start'],
  confirmLabels: {
    leave_approval_submit: '📋 确认提交表单',
    leave_approval_start: '🚀 确认发起审批流程',
  },
};
