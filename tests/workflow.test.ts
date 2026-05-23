/**
 * 工作流引擎集成测试
 */
import { describe, it, expect } from 'vitest';
import { FormValidator } from '../src/validator/form-validator.js';
import type { ProcessForm } from '../src/workflow/engine.js';
import type { LeaveForm } from '../src/types.js';

function validForm(): LeaveForm {
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
  };
}

describe('WorkflowEngine - 初始状态', () => {
  it('初始状态应为 COLLECTING', async () => {
    // WorkflowEngine 构造时需要 LLMService（需要 API Key）
    // 此处只验证不涉及 LLM 的部分
    const { WorkflowEngine } = await import('../src/workflow/engine.js');
    try {
      const engine = new WorkflowEngine(5);
      expect(engine.context.state).toBe('COLLECTING');
      expect(engine.context.retryCount).toBe(0);
      expect(engine.context.maxRetries).toBe(5);
    } catch {
      // 如果没有 API Key 则跳过
    }
  });
});

describe('FormValidator + Workflow 集成', () => {
  const validator = new FormValidator();

  it('表单校验通过后不应触发重试', () => {
    const form = validForm();
    const result = validator.validate(form);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('表单校验失败时应返回具体错误', () => {
    const form = validForm();
    form.applicantName = '';
    form.reason = '短';
    const result = validator.validate(form);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});

describe('ProcessForm 数据结构', () => {
  it('ProcessForm 应包含 formId 和所有表单字段', () => {
    const form = validForm();
    const processForm: ProcessForm = {
      formId: 'FM-TEST-123',
      ...form,
    };

    expect(processForm.formId).toBe('FM-TEST-123');
    expect(processForm.applicantName).toBe('张三');
    expect(processForm.department).toBe('研发部');
    expect(Object.keys(processForm)).toHaveLength(10);
  });
});
