/**
 * 病假申请 — Mock API
 */
function mockId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export async function submitSickLeave(form: Record<string, string>) {
  console.log('\n📡 [Mock API] 提交病假申请...');
  await delay(300);
  const sickId = mockId('SL');
  console.log(`✅ [Mock API] 病假申请提交成功，ID: ${sickId}`);
  return { success: true, resultId: sickId, form };
}

export async function startSickLeaveProcess(resultId: string, _form: Record<string, string>) {
  console.log(`\n🚀 [Mock API] 发起病假审批 (${resultId})...`);
  await delay(500);
  const processId = mockId('SP');
  console.log(`✅ [Mock API] 病假审批发起成功，ID: ${processId}`);
  return {
    success: true,
    processId,
    message: `病假申请已提交审批，流程ID: ${processId}。请保存好医院证明备查。`,
  };
}
