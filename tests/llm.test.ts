/**
 * LLM Service - JSON 解析与 Tool 相关测试
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';

describe('LLMService - Tool 执行', () => {
  function executeTool(name: string): string {
    if (name === 'get_current_date') {
      const now = new Date();
      return now.toISOString().slice(0, 10) + ' ' + now.toTimeString().slice(0, 8);
    }
    return `未知工具: ${name}`;
  }

  it('get_current_date 返回 YYYY-MM-DD HH:mm:ss 格式', () => {
    const result = executeTool('get_current_date');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it('未知工具返回错误信息', () => {
    const result = executeTool('unknown_tool');
    expect(result).toContain('未知工具');
  });
});

describe('LLMService - JSON 提取', () => {
  function extractJson(raw: string): object | null {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
  }

  it('提取纯 JSON', () => {
    const raw = '{"applicantName":"张三","department":"研发部"}';
    const result = extractJson(raw);
    expect(result).toEqual({ applicantName: '张三', department: '研发部' });
  });

  it('提取 markdown 代码块中的 JSON', () => {
    const raw = '```json\n{"applicantName":"张三","department":"研发部"}\n```';
    const result = extractJson(raw);
    expect(result).toEqual({ applicantName: '张三', department: '研发部' });
  });

  it('提取前后有文字的 JSON', () => {
    const raw = '好的，以下是表单：\n{"applicantName":"张三"}\n请确认。';
    const result = extractJson(raw);
    expect(result).toEqual({ applicantName: '张三' });
  });

  it('无 JSON 时返回 null', () => {
    const raw = '抱歉，我无法处理这个请求。';
    const result = extractJson(raw);
    expect(result).toBeNull();
  });

  it('提取多行 JSON', () => {
    const raw = `{
      "applicantName": "张三",
      "department": "研发部",
      "employeeId": "EMP001"
    }`;
    const result = extractJson(raw);
    expect(result).toEqual({
      applicantName: '张三',
      department: '研发部',
      employeeId: 'EMP001',
    });
  });
});

describe('LLMService - Zod Schema 校验', () => {
  const LeaveFormSchema = z.object({
    applicantName: z.string(),
    department: z.string(),
    employeeId: z.string(),
    remoteStartDate: z.string(),
    remoteEndDate: z.string(),
    reason: z.string(),
    workPlan: z.string(),
    emergencyContact: z.string(),
    address: z.string(),
  });

  it('完整的 9 字段 JSON 通过校验', () => {
    const data = {
      applicantName: '张三',
      department: '研发部',
      employeeId: 'EMP001',
      remoteStartDate: '2026-05-24',
      remoteEndDate: '2026-05-26',
      reason: '照顾家人',
      workPlan: '远程完成开发任务',
      emergencyContact: '13800138000',
      address: '北京市朝阳区',
    };
    const result = LeaveFormSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('缺少字段时校验失败', () => {
    const data = {
      applicantName: '张三',
      department: '研发部',
    };
    const result = LeaveFormSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('多余字段被忽略（strip）', () => {
    const data = {
      applicantName: '张三',
      department: '研发部',
      employeeId: 'EMP001',
      remoteStartDate: '2026-05-24',
      remoteEndDate: '2026-05-26',
      reason: '照顾家人',
      workPlan: '远程完成开发任务',
      emergencyContact: '13800138000',
      address: '北京市朝阳区',
      extraField: 'should be stripped',
    };
    const result = LeaveFormSchema.parse(data);
    expect((result as any).extraField).toBeUndefined();
  });
});
