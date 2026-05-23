/**
 * FormValidator 单元测试
 */
import { describe, it } from 'vitest';
import { FormValidator } from '../src/validator/form-validator.js';
import type { LeaveForm } from '../src/types.js';

describe('FormValidator', () => {
  const validator = new FormValidator();

  function validForm(overrides?: Partial<LeaveForm>): LeaveForm {
    return {
      applicantName: '张三',
      department: '研发部',
      employeeId: 'EMP001',
      remoteStartDate: '2099-06-01',
      remoteEndDate: '2099-06-03',
      reason: '家中有事需要处理，同时可以保持正常工作进度',
      workPlan: '每天按时参加站会，完成前端开发任务，保持即时通讯在线响应',
      emergencyContact: '13800138000',
      address: '北京市朝阳区xx小区',
      ...overrides,
    };
  }

  it('should pass valid form', ({ expect }) => {
    const result = validator.validate(validForm());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect missing required fields', ({ expect }) => {
    const result = validator.validate(validForm({ applicantName: '' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('申请人姓名'))).toBe(true);
  });

  it('should detect invalid date format', ({ expect }) => {
    const result = validator.validate(validForm({ remoteStartDate: '99-06-01' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('YYYY-MM-DD'))).toBe(true);
  });

  it('should detect end date before start date', ({ expect }) => {
    const result = validator.validate(validForm({
      remoteStartDate: '2099-06-10',
      remoteEndDate: '2099-06-05',
    }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('结束日期不能早于开始日期'))).toBe(true);
  });

  it('should detect span > 30 days', ({ expect }) => {
    const result = validator.validate(validForm({
      remoteStartDate: '2099-06-01',
      remoteEndDate: '2099-07-15',
    }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('30 天'))).toBe(true);
  });

  it('should detect short reason', ({ expect }) => {
    const result = validator.validate(validForm({ reason: '有事' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('至少 10 个字'))).toBe(true);
  });

  it('should detect short work plan', ({ expect }) => {
    const result = validator.validate(validForm({ workPlan: '正常工作' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('至少 20 个字'))).toBe(true);
  });

  it('should detect invalid contact', ({ expect }) => {
    const result = validator.validate(validForm({ emergencyContact: 'abc' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('手机号或邮箱'))).toBe(true);
  });

  it('should accept email as contact', ({ expect }) => {
    const result = validator.validate(validForm({ emergencyContact: 'test@example.com' }));
    expect(result.valid).toBe(true);
  });

  it('should accumulate multiple errors', ({ expect }) => {
    const result = validator.validate(validForm({
      applicantName: '',
      reason: '短',
      workPlan: '短',
      emergencyContact: 'xxx',
    }));
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(4);
  });
});
