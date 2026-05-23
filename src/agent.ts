/**
 * Pi Agent 定义 — 基于 @earendil-works/pi-agent-core + @earendil-works/pi-ai
 * 
 * Provider: zai (智谱 GLM) via OPENAI_API_KEY
 * Pi 自动发现模型: zai/glm-5-turbo, zai/glm-5.1, zai/glm-4.7 等
 */
import { Type, getModel, streamSimple } from '@earendil-works/pi-ai';
import type { AgentTool } from '@earendil-works/pi-agent-core';
import { validateForm } from './validator.js';
import { submitForm, startProcess } from './api.js';
import { config } from './config.js';

// ─── Tool 定义 ───────────────────────────────────────────────

export const getCurrentDateTool: AgentTool<any> = {
  name: 'get_current_date',
  label: '获取当前日期',
  description: '获取当前日期和时间。返回 YYYY-MM-DD HH:mm:ss。填日期前必须先调用此工具。',
  parameters: Type.Object({}),
  execute: async () => {
    const now = new Date();
    return {
      content: [{ type: 'text' as const, text: now.toISOString().slice(0, 10) + ' ' + now.toTimeString().slice(0, 8) }],
      details: null,
    };
  },
};

export const validateFormTool: AgentTool<any> = {
  name: 'validate_form',
  label: '校验表单',
  description: '校验远程办公申请表单。返回 JSON: { valid: boolean, errors: string[] }。',
  parameters: Type.Object({
    form: Type.Object({
      applicantName: Type.String(),
      department: Type.String(),
      employeeId: Type.String(),
      remoteStartDate: Type.String({ description: 'YYYY-MM-DD' }),
      remoteEndDate: Type.String({ description: 'YYYY-MM-DD' }),
      reason: Type.String(),
      workPlan: Type.String(),
      emergencyContact: Type.String(),
      address: Type.String(),
    }),
  }),
  execute: async (_id: string, params: unknown) => {
    const { form } = params as { form: any };
    const result = validateForm(form);
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result) }],
      details: result,
    };
  },
};

export const submitFormTool: AgentTool<any> = {
  name: 'submit_form',
  label: '提交表单',
  description: '提交远程办公申请表单获取 formId。必须先获得用户确认！',
  parameters: Type.Object({
    form: Type.Object({
      applicantName: Type.String(),
      department: Type.String(),
      employeeId: Type.String(),
      remoteStartDate: Type.String(),
      remoteEndDate: Type.String(),
      reason: Type.String(),
      workPlan: Type.String(),
      emergencyContact: Type.String(),
      address: Type.String(),
    }),
  }),
  execute: async (_id: string, params: unknown) => {
    const { form } = params as { form: any };
    const result = await submitForm(form);
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result) }],
      details: result,
    };
  },
};

export const startProcessTool: AgentTool<any> = {
  name: 'start_process',
  label: '发起流程',
  description: '发起审批流程。需要 formId 和表单。必须先获得用户二次确认！',
  parameters: Type.Object({
    formId: Type.String({ description: '表单ID' }),
    form: Type.Object({
      applicantName: Type.String(),
      department: Type.String(),
      employeeId: Type.String(),
      remoteStartDate: Type.String(),
      remoteEndDate: Type.String(),
      reason: Type.String(),
      workPlan: Type.String(),
      emergencyContact: Type.String(),
      address: Type.String(),
    }),
  }),
  execute: async (_id: string, params: unknown) => {
    const { formId, form } = params as { formId: string; form: any };
    const result = await startProcess(formId, form);
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result) }],
      details: result,
    };
  },
};

export const allTools: AgentTool<any>[] = [
  getCurrentDateTool,
  validateFormTool,
  submitFormTool,
  startProcessTool,
];

// ─── System Prompt ──────────────────────────────────────────

export const SYSTEM_PROMPT = `你是一个远程办公申请自动化审批助手。

## 工作流程

### Phase 1: 获取日期并填写表单
1. 调用 get_current_date 获取当前日期
2. 根据用户需求填写远程办公申请表单（信息不完整时可合理推断补充）
3. 调用 validate_form 校验表单
4. 如果校验不通过，查看 errors 修正后重新 validate_form（最多 ${config.maxFormRetries} 次）
5. 校验通过后，清晰展示表单给用户，等待确认

### Phase 2: 第一次用户确认
- 展示完整的表单字段，明确询问是否确认提交

### Phase 3: 提交表单
- 用户确认后调用 submit_form，获取 formId

### Phase 4: 第二次用户确认
- 展示包含 formId 的完整流程信息，询问是否发起审批

### Phase 5: 发起流程
- 用户确认后调用 start_process，返回结果

## 规则
- 日期 YYYY-MM-DD，不早于今天，单次不超过30天
- 原因至少10字，工作安排至少20字
- 联系方式为手机号(1开头11位)或邮箱
- 提交和发起前必须获得用户确认`;

// ─── Model ──────────────────────────────────────────────────

export function getDefaultModel() {
  try {
    return getModel('zai', 'glm-5-turbo' as any);
  } catch {
    return getModel('zai', 'glm-4.7' as any);
  }
}
