/**
 * 模拟 API - 表单提交和流程发起的 Mock 实现
 * 生产环境替换为真实 HTTP 调用
 */
import type { LeaveForm, FormSubmitResult, ProcessResult } from '../types.js';

function mockId(prefix: string): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${ts}-${rand}`;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** 模拟表单提交接口 */
export async function submitForm(form: LeaveForm): Promise<FormSubmitResult> {
  console.log('\n📡 [Mock API] 正在提交表单...');
  await delay(300 + Math.random() * 400);

  const formId = mockId('FM');
  console.log(`✅ [Mock API] 表单提交成功，表单ID: ${formId}`);
  return { success: true, formId, form };
}

/** 模拟流程发起接口 */
export async function startProcess(formId: string, _form: LeaveForm): Promise<ProcessResult> {
  console.log(`\n🚀 [Mock API] 正在发起审批流程 (表单: ${formId})...`);
  await delay(500 + Math.random() * 500);

  const processId = mockId('PS');
  console.log(`✅ [Mock API] 流程发起成功，流程ID: ${processId}`);
  return {
    success: true,
    processId,
    message: `远程办公申请已提交审批，流程ID: ${processId}。审批人将在 1-3 个工作日内处理。`,
  };
}
