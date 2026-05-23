/**
 * Mock API — 表单提交 & 流程发起
 *
 * 模拟后端接口，生成唯一的 formId 和 processId。
 * 实际生产环境应替换为真实 API 调用。
 */
import type { LeaveForm, FormSubmitResult, ProcessResult } from '../shared/types.js';

/** 生成带前缀的唯一 ID */
function mockId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

/** 模拟网络延迟 */
const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/**
 * 提交表单
 * @returns 含 formId 的结果
 */
export async function submitForm(form: LeaveForm): Promise<FormSubmitResult> {
  console.log('\n📡 [Mock API] 提交表单...');
  await delay(300);
  const formId = mockId('FM');
  console.log(`✅ [Mock API] 表单提交成功，ID: ${formId}`);
  return { success: true, formId, form };
}

/**
 * 发起审批流程
 * @param formId 表单 ID（由 submitForm 返回）
 * @param _form  表单数据（预留，实际 API 可能需要）
 * @returns 含 processId 的结果
 */
export async function startProcess(formId: string, _form: LeaveForm): Promise<ProcessResult> {
  console.log(`\n🚀 [Mock API] 发起流程 (${formId})...`);
  await delay(500);
  const processId = mockId('PS');
  console.log(`✅ [Mock API] 流程发起成功，ID: ${processId}`);
  return {
    success: true,
    processId,
    message: `远程办公申请已提交审批，流程ID: ${processId}。审批人将在 1-3 个工作日内处理。`
  };
}
