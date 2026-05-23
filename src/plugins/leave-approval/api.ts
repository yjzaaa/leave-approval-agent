/**
 * 远程办公审批 — Mock API
 *
 * 模拟后端接口，实际生产环境替换为真实 API 调用。
 */
import type { LeaveForm } from '../../shared/types.js';

/** 生成唯一 ID */
function mockId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

/** 模拟延迟 */
const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/**
 * 提交表单（符合 BusinessPlugin.submitApi 签名）
 */
export async function submitLeaveForm(form: Record<string, string>): Promise<{
  success: boolean;
  resultId?: string;
  message?: string;
  form?: Record<string, string>;
}> {
  console.log('\n📡 [Mock API] 提交远程办公表单...');
  await delay(300);
  const formId = mockId('FM');
  console.log(`✅ [Mock API] 表单提交成功，ID: ${formId}`);
  return { success: true, resultId: formId, form };
}

/**
 * 发起审批流程（符合 BusinessPlugin.startProcessApi 签名）
 */
export async function startLeaveProcess(resultId: string, _form: Record<string, string>): Promise<{
  success: boolean;
  processId?: string;
  message?: string;
}> {
  console.log(`\n🚀 [Mock API] 发起审批流程 (${resultId})...`);
  await delay(500);
  const processId = mockId('PS');
  console.log(`✅ [Mock API] 流程发起成功，ID: ${processId}`);
  return {
    success: true,
    processId,
    message: `远程办公申请已提交审批，流程ID: ${processId}。审批人将在 1-3 个工作日内处理。`,
  };
}
