/**
 * Mock API - 表单提交 & 流程发起
 */
import type { LeaveForm, FormSubmitResult, ProcessResult } from './types.js';

function mockId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export async function submitForm(form: LeaveForm): Promise<FormSubmitResult> {
  console.log('\n📡 [Mock API] 提交表单...');
  await delay(300);
  const formId = mockId('FM');
  console.log(`✅ [Mock API] 表单提交成功，ID: ${formId}`);
  return { success: true, formId, form };
}

export async function startProcess(formId: string, _form: LeaveForm): Promise<ProcessResult> {
  console.log(`\n🚀 [Mock API] 发起流程 (${formId})...`);
  await delay(500);
  const processId = mockId('PS');
  console.log(`✅ [Mock API] 流程发起成功，ID: ${processId}`);
  return { success: true, processId, message: `远程办公申请已提交审批，流程ID: ${processId}。审批人将在 1-3 个工作日内处理。` };
}
