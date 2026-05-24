/**
 * 远程办公审批 — 表单校验规则
 */
import type { ValidationResult } from '../../domain/models/ValidationResult.js';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function validateLeaveForm(form: Record<string, string>): ValidationResult {
  const errors: string[] = [];

  // ── 1. 非空检查 ──
  const required: Array<[string, string]> = [
    ['applicantName', '申请人姓名'],
    ['department', '部门'],
    ['employeeId', '工号'],
    ['remoteStartDate', '开始日期'],
    ['remoteEndDate', '结束日期'],
    ['reason', '远程办公原因'],
    ['workPlan', '工作安排'],
    ['emergencyContact', '紧急联系方式'],
    ['address', '远程办公地址'],
  ];
  for (const [key, label] of required) {
    if (!form[key] || form[key].trim() === '') {
      errors.push(`【必填】${label} 不能为空`);
    }
  }

  // ── 2. 日期格式校验 ──
  if (form.remoteStartDate && !DATE_REGEX.test(form.remoteStartDate))
    errors.push('开始日期格式应为 YYYY-MM-DD');
  if (form.remoteEndDate && !DATE_REGEX.test(form.remoteEndDate))
    errors.push('结束日期格式应为 YYYY-MM-DD');

  // ── 3. 日期逻辑校验 ──
  if (form.remoteStartDate && form.remoteEndDate
      && DATE_REGEX.test(form.remoteStartDate) && DATE_REGEX.test(form.remoteEndDate)) {
    const start = new Date(form.remoteStartDate);
    const end = new Date(form.remoteEndDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!isNaN(start.getTime()) && start < today)
      errors.push('开始日期不能早于今天');
    if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end < start)
      errors.push('结束日期不能早于开始日期');
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      const diff = Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1;
      if (diff > 30) errors.push('单次远程办公不能超过 30 天');
    }
  }

  // ── 4. 长度校验 ──
  if (form.reason && form.reason.length < 10)
    errors.push('远程办公原因至少 10 字');
  if (form.workPlan && form.workPlan.length < 20)
    errors.push('工作安排至少 20 字');

  // ── 5. 联系方式校验 ──
  if (form.emergencyContact) {
    const ok = /^1[3-9]\d{9}$/.test(form.emergencyContact)
      || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.emergencyContact);
    if (!ok) errors.push('紧急联系方式需为手机号或邮箱');
  }

  return { valid: errors.length === 0, errors };
}
