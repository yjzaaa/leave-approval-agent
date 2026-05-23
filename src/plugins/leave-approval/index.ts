/**
 * 远程办公审批 — 插件入口
 *
 * 导出一个完整的 BusinessPlugin 实例，包含：
 *   - 表单字段定义
 *   - System Prompt
 *   - 表单校验
 *   - Mock API
 *
 * 注册到 registry 后即可被 Agent 框架加载。
 */
import type { BusinessPlugin } from '../../shared/plugin.js';
import { leaveFields } from './fields.js';
import { leavePrompt } from './prompt.js';
import { validateLeaveForm } from './validator.js';
import { submitLeaveForm, startLeaveProcess } from './api.js';

export const leavePlugin: BusinessPlugin = {
  id: 'leave_approval',
  displayName: '远程办公审批',
  fields: leaveFields,
  systemPrompt: leavePrompt,
  // Tool 列表由框架的 buildTools() 自动生成，插件无需手动指定
  tools: [] as any, // 占位，由 agent-factory 的 buildTools() 覆盖
  validate: validateLeaveForm,
  submitApi: submitLeaveForm,
  startProcessApi: startLeaveProcess,
  suggestions: [
    '我需要申请远程办公',
    '家人住院需要照顾',
    '身体不适在家办公',
  ],
  confirmLabels: {
    submit: '📋 确认提交表单',
    start: '🚀 确认发起审批流程',
  },
};
