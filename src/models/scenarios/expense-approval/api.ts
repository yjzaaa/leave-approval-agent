/**
 * 报销审批 — Mock API
 */
import type { SubmitResult, StartProcessResult } from '../../domain/dto/ApiResponses.js';

function mockId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/** 提交报销申请 */
export async function submitExpense(form: Record<string, string>): Promise<SubmitResult> {
  console.log('\n📡 [Mock API] 提交报销申请...');
  await delay(300);
  const expenseId = mockId('EX');
  console.log(`✅ [Mock API] 报销提交成功，ID: ${expenseId}`);
  const result: SubmitResult = { success: true, resultId: expenseId, form };
  return result;
}

/** 发起报销审批 */
export async function startExpenseProcess(resultId: string, _form: Record<string, string>): Promise<StartProcessResult> {
  console.log(`\n🚀 [Mock API] 发起报销审批 (${resultId})...`);
  await delay(500);
  const processId = mockId('EP');
  console.log(`✅ [Mock API] 报销审批发起成功，ID: ${processId}`);
  const result: StartProcessResult = {
    success: true,
    processId,
    message: `报销申请已提交审批，流程ID: ${processId}。财务将在 3-5 个工作日内处理。`,
  };
  return result;
}
