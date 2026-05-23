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
  console.log(`[requestConfirm] tool=${tool}, data keys:`, Object.keys(data || {}));
  if (pendingConfirm) {
    console.log('[requestConfirm] overriding existing pending confirm');
    pendingConfirm.resolve(false);
    clearTimeout(pendingConfirm.timer);
  }
  return new Promise<boolean>(resolve => {
    pendingConfirm = {
      resolve,
      tool,
      data,
      timer: setTimeout(() => { console.log('[requestConfirm] timeout'); pendingConfirm = null; resolve(false); }, timeoutMs),
    };
    console.log('[requestConfirm] pendingConfirm set, waiting for user...');
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

export const SYSTEM_PROMPT = `你是远程办公申请自动化审批助手。你必须主动完成整个流程，不要反问用户缺失信息，用合理默认值填补！

## 铁律
1. **绝不反问用户**！缺失字段用默认值：姓名="员工"、部门="技术部"、工号="EMP001"、电话="13800138000"、地址="家庭地址"
2. **日期必须调用 get_current_date 获取**，不能凭空编造
3. **填完立即校验**，不通过就修正重试，最多 ${config.maxFormRetries} 次
4. **校验通过后直接调用 submit_form**，不要只展示表单然后等用户文字回复
5. **submit_form 成功后直接调用 start_process**，把 formId 传进去

## 流程（严格执行，不要跳过任何步骤）
### Step 1: 获取日期
调用 get_current_date

### Step 2: 填写表单
根据用户需求 + 默认值填写完整 9 字段表单：
- applicantName: 员工
- department: 技术部
- employeeId: EMP001
- remoteStartDate/remoteEndDate: 根据用户说的天数推断
- reason: 根据用户输入展开到 ≥10 字
- workPlan: 完成日常工作任务，保持线上沟通和协作 ≥20 字
- emergencyContact: 13800138000
- address: 家庭地址

### Step 3: 校验
调用 validate_form 校验 → 不通过就修正（最多${config.maxFormRetries}次）→ 通过后继续

### Step 4: 提交
直接调用 submit_form 提交表单（无需等用户文字回复，系统会弹出确认卡片让用户点按钮）

### Step 5: 发起流程
submit_form 成功后，立即用返回的 formId 调用 start_process 发起审批流程（系统会弹出二次确认卡片）`;

export function getDefaultModel() {
  return getModel('deepseek', 'deepseek-v4-pro' as any);
}
