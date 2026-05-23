/**
 * 病假申请 — 表单校验规则
 */
import type { ValidationResult } from '../../shared/plugin.js';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function validateSickLeaveForm(form: Record<string, string>): ValidationResult {
  const errors: string[] = [];

  // ── 1. 非空检查 ──
  const required: Array<[string, string]> = [
    ['applicantName', '申请人'],
    ['department', '部门'],
    ['employeeId', '工号'],
    ['startDate', '请假开始日期'],
    ['endDate', '请假结束日期'],
    ['diagnosis', '诊断/病因'],
    ['doctorNote', '医生建议'],
    ['emergencyContact', '紧急联系人'],
  ];
  for (const [key, label] of required) {
    if (!form[key] || form[key].trim() === '') {
      errors.push(`【必填】${label} 不能为空`);
    }
  }

  // ── 2. 日期格式校验 ──
  if (form.startDate && !DATE_REGEX.test(form.startDate))
    errors.push('开始日期格式应为 YYYY-MM-DD');
  if (form.endDate && !DATE_REGEX.test(form.endDate))
    errors.push('结束日期格式应为 YYYY-MM-DD');

  // ── 3. 日期逻辑校验 ──
  if (form.startDate && form.endDate
      && DATE_REGEX.test(form.startDate) && DATE_REGEX.test(form.endDate)) {
    const start = new Date(form.startDate);
    const end = new Date(form.endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!isNaN(start.getTime()) && start < today)
      errors.push('请假开始日期不能早于今天（如需补请，请走补请假流程）');
    if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end < start)
      errors.push('结束日期不能早于开始日期');
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      const diff = Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1;
      if (diff > 30) errors.push('单次病假申请不能超过 30 天（需医院出具详细证明）');
      if (diff < 1) errors.push('请假天数至少为 1 天');
    }
  }

  // ── 4. 内容长度校验 ──
  if (form.diagnosis && form.diagnosis.length < 10)
    errors.push('诊断/病因描述至少 10 字，请具体描述症状');
  if (form.doctorNote && form.doctorNote.length < 10)
    errors.push('医生建议至少 10 字');

  // ── 5. 联系方式校验 ──
  if (form.emergencyContact) {
    const ok = /^1[3-9]\d{9}$/.test(form.emergencyContact)
      || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.emergencyContact);
    if (!ok) errors.push('紧急联系人需为手机号或邮箱');
  }

  return { valid: errors.length === 0, errors };
}
