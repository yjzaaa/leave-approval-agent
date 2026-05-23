/**
 * 校验器、API、Agent 工具集成测试
 */
import { describe, it, expect } from 'vitest';
import { validateForm } from '../src/validator.js';

describe('Validator', () => {
  function validForm() {
    return {
      applicantName: '张三', department: '研发部', employeeId: 'EMP001',
      remoteStartDate: '2099-06-01', remoteEndDate: '2099-06-03',
      reason: '家中有事需要处理，同时可以保持正常工作进度',
      workPlan: '每天按时参加站会，完成前端开发任务，保持即时通讯在线响应',
      emergencyContact: '13800138000', address: '北京市朝阳区xx小区',
    };
  }

  it('valid form passes', () => {
    const r = validateForm(validForm());
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('missing name fails', () => {
    const r = validateForm({ ...validForm(), applicantName: '' });
    expect(r.valid).toBe(false);
  });

  it('bad date format fails', () => {
    const r = validateForm({ ...validForm(), remoteStartDate: '99-06-01' });
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes('YYYY-MM-DD'))).toBe(true);
  });

  it('end before start fails', () => {
    const r = validateForm({ ...validForm(), remoteStartDate: '2099-06-10', remoteEndDate: '2099-06-05' });
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes('不能早于开始日期'))).toBe(true);
  });

  it('span > 30 days fails', () => {
    const r = validateForm({ ...validForm(), remoteStartDate: '2099-06-01', remoteEndDate: '2099-07-15' });
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes('30 天'))).toBe(true);
  });

  it('short reason fails', () => {
    const r = validateForm({ ...validForm(), reason: '有事' });
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes('10 个字'))).toBe(true);
  });

  it('bad contact fails', () => {
    const r = validateForm({ ...validForm(), emergencyContact: 'abc' });
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes('手机号或邮箱'))).toBe(true);
  });
});

describe('Mock API', () => {
  it('submitForm returns formId', async () => {
    const { submitForm } = await import('../src/api.js');
    const result = await submitForm({
      applicantName: '张三', department: '研发部', employeeId: 'EMP001',
      remoteStartDate: '2099-06-01', remoteEndDate: '2099-06-03',
      reason: '照顾家人', workPlan: '远程完成开发任务',
      emergencyContact: '13800138000', address: '北京市',
    });
    expect(result.success).toBe(true);
    expect(result.formId).toMatch(/^FM-/);
  });

  it('startProcess returns processId', async () => {
    const { startProcess } = await import('../src/api.js');
    const result = await startProcess('FM-TEST', {
      applicantName: '张三', department: '研发部', employeeId: 'EMP001',
      remoteStartDate: '2099-06-01', remoteEndDate: '2099-06-03',
      reason: '照顾家人', workPlan: '远程完成开发任务',
      emergencyContact: '13800138000', address: '北京市',
    });
    expect(result.success).toBe(true);
    expect(result.processId).toMatch(/^PS-/);
  });
});

describe('Agent Tools', () => {
  it('getCurrentDateTool returns valid date', async () => {
    const { getCurrentDateTool } = await import('../src/agent.js');
    const result = await getCurrentDateTool.execute('test-id', {});
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it('validateFormTool detects errors', async () => {
    const { validateFormTool } = await import('../src/agent.js');
    const result = await validateFormTool.execute('test-id', {
      form: { applicantName: '', department: '研发部', employeeId: 'E001',
        remoteStartDate: 'bad', remoteEndDate: 'bad',
        reason: '短', workPlan: '短', emergencyContact: 'xx', address: '' }
    });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.valid).toBe(false);
    expect(parsed.errors.length).toBeGreaterThan(0);
  });
});
