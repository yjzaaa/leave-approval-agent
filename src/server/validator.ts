/**
 * 表单校验引擎
 */
import type { LeaveForm, ValidationResult } from '../shared/types.js';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function validateForm(form: LeaveForm): ValidationResult {
  const errors: string[] = [];

  // 必填
  const required: [keyof LeaveForm, string][] = [
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
  for (const [f, label] of required) {
    if (!form[f] || form[f].trim() === '') errors.push(`【必填】${label} 不能为空`);
  }

  // 日期
  if (form.remoteStartDate && !DATE_REGEX.test(form.remoteStartDate))
    errors.push('开始日期格式应为 YYYY-MM-DD');
  if (form.remoteEndDate && !DATE_REGEX.test(form.remoteEndDate))
    errors.push('结束日期格式应为 YYYY-MM-DD');

  if (form.remoteStartDate && form.remoteEndDate
      && DATE_REGEX.test(form.remoteStartDate) && DATE_REGEX.test(form.remoteEndDate)) {
    const start = new Date(form.remoteStartDate);
    const end = new Date(form.remoteEndDate);
    const today = new Date(); today.setHours(0, 0, 0, 0);

    if (!isNaN(start.getTime()) && start < today)
      errors.push('开始日期不能早于今天');
    if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end < start)
      errors.push('结束日期不能早于开始日期');
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      const diff = Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1;
      if (diff > 30) errors.push('单次远程办公不能超过 30 天');
    }
  }

  // 长度
  if (form.reason && form.reason.length < 10)
    errors.push('远程办公原因至少 10 个字');
  if (form.workPlan && form.workPlan.length < 20)
    errors.push('工作安排至少 20 个字');

  // 联系方式
  if (form.emergencyContact) {
    const ok = /^1[3-9]\d{9}$/.test(form.emergencyContact)
      || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.emergencyContact);
    if (!ok) errors.push('紧急联系方式请填手机号或邮箱');
  }

  return { valid: errors.length === 0, errors };
}
