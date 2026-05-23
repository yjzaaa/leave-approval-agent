/**
 * 表单校验引擎 - 多维度校验远程办公申请表单
 */
import type { LeaveForm, ValidationResult } from '../types.js';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export class FormValidator {
  /**
   * 校验完整的申请表单，返回校验结果
   */
  validate(form: LeaveForm): ValidationResult {
    const errors: string[] = [];

    this.validateRequired(form, errors);
    this.validateDates(form, errors);
    this.validateLengths(form, errors);
    this.validateContact(form, errors);

    return { valid: errors.length === 0, errors };
  }

  /** 必填字段检查 */
  private validateRequired(form: LeaveForm, errors: string[]): void {
    const required: [keyof LeaveForm, string][] = [
      ['applicantName', '申请人姓名'],
      ['department', '部门'],
      ['employeeId', '工号'],
      ['remoteStartDate', '远程办公开始日期'],
      ['remoteEndDate', '远程办公结束日期'],
      ['reason', '远程办公原因'],
      ['workPlan', '工作安排'],
      ['emergencyContact', '紧急联系方式'],
      ['address', '远程办公地址'],
    ];
    for (const [field, label] of required) {
      if (!form[field] || form[field].trim() === '') {
        errors.push(`【必填】${label} 不能为空`);
      }
    }
  }

  /** 日期格式与逻辑校验 */
  private validateDates(form: LeaveForm, errors: string[]): void {
    const { remoteStartDate, remoteEndDate } = form;

    if (remoteStartDate && !DATE_REGEX.test(remoteStartDate)) {
      errors.push('开始日期格式不正确，应为 YYYY-MM-DD');
    }
    if (remoteEndDate && !DATE_REGEX.test(remoteEndDate)) {
      errors.push('结束日期格式不正确，应为 YYYY-MM-DD');
    }

    if (
      remoteStartDate && remoteEndDate &&
      DATE_REGEX.test(remoteStartDate) && DATE_REGEX.test(remoteEndDate)
    ) {
      const start = new Date(remoteStartDate);
      const end = new Date(remoteEndDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (isNaN(start.getTime())) {
        errors.push('开始日期不是有效日期');
      }
      if (isNaN(end.getTime())) {
        errors.push('结束日期不是有效日期');
      }
      if (!isNaN(start.getTime()) && start < today) {
        errors.push('开始日期不能早于今天');
      }
      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end < start) {
        errors.push('结束日期不能早于开始日期');
      }
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        if (diffDays > 30) {
          errors.push('单次远程办公不能超过 30 天，请分段申请');
        }
      }
    }
  }

  /** 字段长度校验 */
  private validateLengths(form: LeaveForm, errors: string[]): void {
    if (form.reason && form.reason.length < 10) {
      errors.push('远程办公原因描述过短，请详细说明（至少 10 个字）');
    }
    if (form.workPlan && form.workPlan.length < 20) {
      errors.push('工作安排描述过短，请说明具体工作内容（至少 20 个字）');
    }
    if (form.reason && form.reason.length > 500) {
      errors.push('远程办公原因描述不能超过 500 字');
    }
    if (form.workPlan && form.workPlan.length > 1000) {
      errors.push('工作安排描述不能超过 1000 字');
    }
  }

  /** 联系方式格式校验 */
  private validateContact(form: LeaveForm, errors: string[]): void {
    if (form.emergencyContact) {
      const phoneRegex = /^1[3-9]\d{9}$/;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!phoneRegex.test(form.emergencyContact) && !emailRegex.test(form.emergencyContact)) {
        errors.push('紧急联系方式请填写手机号或邮箱');
      }
    }
  }
}
