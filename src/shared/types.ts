/**
 * 共享层 — 领域类型定义
 * 远程办公申请的核心数据结构，被 client 和 server 共同引用
 */

/** 远程办公申请表单 */
export interface LeaveForm {
  applicantName: string;
  department: string;
  employeeId: string;
  remoteStartDate: string;
  remoteEndDate: string;
  reason: string;
  workPlan: string;
  emergencyContact: string;
  address: string;
}

/** 流程表单（含 formId） */
export interface ProcessForm extends LeaveForm {
  formId: string;
}

/** 表单提交结果 */
export interface FormSubmitResult {
  success: boolean;
  formId?: string;
  form?: LeaveForm;
  errors?: string[];
}

/** 流程发起结果 */
export interface ProcessResult {
  success: boolean;
  processId?: string;
  message?: string;
  error?: string;
}

/** 聊天消息（用于历史记录） */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/** 校验结果 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
