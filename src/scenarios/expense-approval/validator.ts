/**
 * 报销审批 — 表单校验规则
 */
import type { ValidationResult } from '../../shared/scenario.js';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const VALID_CATEGORIES = ['差旅费', '办公用品', '招待费', '交通费', '通讯费', '其他'];

export function validateExpenseForm(form: Record<string, string>): ValidationResult {
  const errors: string[] = [];

  // ── 1. 非空检查 ──
  const required: Array<[string, string]> = [
    ['applicantName', '申请人'],
    ['department', '部门'],
    ['amount', '报销金额'],
    ['category', '费用类别'],
    ['expenseDate', '费用发生日期'],
    ['description', '费用说明'],
  ];
  for (const [key, label] of required) {
    if (!form[key] || form[key].trim() === '') {
      errors.push(`【必填】${label} 不能为空`);
    }
  }

  // ── 2. 金额校验 ──
  if (form.amount) {
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) {
      errors.push('报销金额必须为大于 0 的数字');
    } else if (amount > 50000) {
      errors.push('单次报销金额不能超过 50000 元（需走特殊审批流程）');
    }
  }

  // ── 3. 费用类别校验 ──
  if (form.category && !VALID_CATEGORIES.includes(form.category)) {
    errors.push(`费用类别必须为: ${VALID_CATEGORIES.join('/')}`);
  }

  // ── 4. 日期校验 ──
  if (form.expenseDate && !DATE_REGEX.test(form.expenseDate)) {
    errors.push('费用发生日期格式应为 YYYY-MM-DD');
  }
  if (form.expenseDate && DATE_REGEX.test(form.expenseDate)) {
    const date = new Date(form.expenseDate);
    if (!isNaN(date.getTime()) && date > new Date()) {
      errors.push('费用发生日期不能晚于今天');
    }
    // 不能早于 90 天前
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    if (!isNaN(date.getTime()) && date < ninetyDaysAgo) {
      errors.push('费用发生日期不能超过 90 天（请走历史报销流程）');
    }
  }

  // ── 5. 说明长度 ──
  if (form.description && form.description.length < 15) {
    errors.push('费用说明至少 15 字');
  }

  // ── 6. 链接格式（可选字段） ──
  if (form.receiptUrl && !/^https?:\/\/.+/.test(form.receiptUrl)) {
    errors.push('发票链接需以 http:// 或 https:// 开头');
  }

  return { valid: errors.length === 0, errors };
}
