/**
 * Pi Agent 定义 — 基于 @earendil-works/pi-agent-core + @earendil-works/pi-ai
 * 
 * Provider: deepseek (DeepSeek) via DEEPSEEK_API_KEY
 * 
 * Human-in-the-Loop: submitFormTool / startProcessTool 内建确认等待
 * resolveConfirm / rejectConfirm 由 web 服务器调用
 */
import { Type, getModel } from '@earendil-works/pi-ai';
import type { AgentTool } from '@earendil-works/pi-agent-core';
import { validateForm } from './validator.js';
import { submitForm, startProcess } from './api.js';
import { config } from './config.js';

// ─── 确认管理器 ───────────────────────────────────────
interface PendingConfirm {
  resolve: (approved: boolean) => void;
  tool: string;
  data: any;
  timer: ReturnType<typeof setTimeout>;
}

let pendingConfirm: PendingConfirm | null = null;

/** 注册一个待确认请求，返回 Promise */
export function requestConfirm(tool: string, data: any, timeoutMs = 120_000): Promise<boolean> {
  if (pendingConfirm) {
    pendingConfirm.resolve(false); // 覆盖旧的
    clearTimeout(pendingConfirm.timer);
  }
  return new Promise<boolean>(resolve => {
    pendingConfirm = {
      resolve,
      tool,
      data,
      timer: setTimeout(() => { pendingConfirm = null; resolve(false); }, timeoutMs),
    };
  });
}

/** 获取当前待确认信息（供服务器读取） */
export function getPendingConfirm() { return pendingConfirm; }

/** 服务器调用：用户确认 */
export function approveConfirm() {
  if (pendingConfirm) {
    clearTimeout(pendingConfirm.timer);
    pendingConfirm.resolve(true);
    pendingConfirm = null;
    return true;
  }
  return false;
}

/** 服务器调用：用户拒绝 */
export function rejectConfirm() {
  if (pendingConfirm) {
    clearTimeout(pendingConfirm.timer);
    pendingConfirm.resolve(false);
    pendingConfirm = null;
    return true;
  }
  return false;
}

// ─── Tools ───────────────────────────────────────────

export const getCurrentDateTool: AgentTool<any> = {
  name: 'get_current_date',
  label: '获取当前日期',
  description: '获取当前日期和时间 YYYY-MM-DD HH:mm:ss。填日期前必须先调用。',
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
  description: '校验远程办公申请表单，返回 { valid, errors[] }。',
  parameters: Type.Object({
    form: Type.Object({
      applicantName: Type.String(), department: Type.String(), employeeId: Type.String(),
      remoteStartDate: Type.String({ description: 'YYYY-MM-DD' }),
      remoteEndDate: Type.String({ description: 'YYYY-MM-DD' }),
      reason: Type.String(), workPlan: Type.String(),
      emergencyContact: Type.String(), address: Type.String(),
    }),
  }),
  execute: async (_id: string, params: unknown) => {
    const { form } = params as { form: any };
    const result = validateForm(form);
    return { content: [{ type: 'text' as const, text: JSON.stringify(result) }], details: result };
  },
};

export const submitFormTool: AgentTool<any> = {
  name: 'submit_form',
  label: '提交表单',
  description: '提交表单获取 formId。必须先获得用户确认！',
  parameters: Type.Object({
    form: Type.Object({
      applicantName: Type.String(), department: Type.String(), employeeId: Type.String(),
      remoteStartDate: Type.String(), remoteEndDate: Type.String(),
      reason: Type.String(), workPlan: Type.String(),
      emergencyContact: Type.String(), address: Type.String(),
    }),
  }),
  execute: async (_id: string, params: unknown) => {
    const { form } = params as { form: any };
    // Human-in-the-Loop: 等待用户确认
    const approved = await requestConfirm('submit_form', form);
    if (!approved) {
      throw new Error('用户拒绝提交表单');
    }
    const result = await submitForm(form);
    return { content: [{ type: 'text' as const, text: JSON.stringify(result) }], details: result };
  },
};

export const startProcessTool: AgentTool<any> = {
  name: 'start_process',
  label: '发起流程',
  description: '发起审批流程，需要 formId。必须先获得用户二次确认！',
  parameters: Type.Object({
    formId: Type.String(), form: Type.Object({
      applicantName: Type.String(), department: Type.String(), employeeId: Type.String(),
      remoteStartDate: Type.String(), remoteEndDate: Type.String(),
      reason: Type.String(), workPlan: Type.String(),
      emergencyContact: Type.String(), address: Type.String(),
    }),
  }),
  execute: async (_id: string, params: unknown) => {
    const { formId, form } = params as { formId: string; form: any };
    // Human-in-the-Loop: 等待用户二次确认
    const approved = await requestConfirm('start_process', { formId, form });
    if (!approved) {
      throw new Error('用户拒绝发起流程');
    }
    const result = await startProcess(formId, form);
    return { content: [{ type: 'text' as const, text: JSON.stringify(result) }], details: result };
  },
};

export const allTools = [getCurrentDateTool, validateFormTool, submitFormTool, startProcessTool];

export const SYSTEM_PROMPT = `你是远程办公申请自动化审批助手。

## 流程
### Phase 1: 填写表单
1. 调用 get_current_date 获取当前日期
2. 根据用户需求填写表单（信息不完整时合理推断）
3. 调用 validate_form 校验，不通过则修正重试（最多 ${config.maxFormRetries} 次）
4. 校验通过后展示表单，告知用户即将提交

### Phase 2: 提交表单
- 调用 submit_form 提交（系统会自动请求用户确认）
- 成功后展示 formId

### Phase 3: 发起流程
- 调用 start_process 发起（系统会自动请求用户二次确认）
- 成功后展示 formId 和 processId`;

export function getDefaultModel() {
  return getModel('deepseek', 'deepseek-v4-pro' as any);
}
