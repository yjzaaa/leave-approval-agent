/**
 * Mock API 测试
 */
import { describe, it, expect } from 'vitest';

describe('Mock API', () => {
  it('submitForm 应返回包含 formId 的成功结果', async () => {
    // 动态 import 避免 LLMService 构造函数执行
    const { submitForm } = await import('../src/api/mock.js');
    const form = {
      applicantName: '张三',
      department: '研发部',
      employeeId: 'EMP001',
      remoteStartDate: '2099-06-01',
      remoteEndDate: '2099-06-03',
      reason: '家中有事需要处理',
      workPlan: '每天按时参加站会完成开发任务',
      emergencyContact: '13800138000',
      address: '北京市朝阳区',
    };

    const result = await submitForm(form);
    expect(result.success).toBe(true);
    expect(result.formId).toBeDefined();
    expect(result.formId).toMatch(/^FM-/);
  });

  it('startProcess 应返回包含 processId 的成功结果', async () => {
    const { startProcess } = await import('../src/api/mock.js');
    const result = await startProcess('FM-TEST-123', {
      applicantName: '张三',
      department: '研发部',
      employeeId: 'EMP001',
      remoteStartDate: '2099-06-01',
      remoteEndDate: '2099-06-03',
      reason: '家中有事需要处理',
      workPlan: '每天按时参加站会完成开发任务',
      emergencyContact: '13800138000',
      address: '北京市朝阳区',
    });

    expect(result.success).toBe(true);
    expect(result.processId).toMatch(/^PS-/);
    expect(result.message).toBeDefined();
  });
});
