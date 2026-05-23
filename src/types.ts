/**
 * 类型定义 - 远程办公申请相关
 */

/** 申请表单 */
export interface LeaveForm {
  applicantName: string;      // 申请人姓名
  department: string;         // 部门
  employeeId: string;         // 工号
  remoteStartDate: string;    // 远程办公开始日期 YYYY-MM-DD
  remoteEndDate: string;      // 远程办公结束日期 YYYY-MM-DD
  reason: string;             // 远程办公原因
  workPlan: string;           // 远程办公期间工作安排
  emergencyContact: string;   // 紧急联系方式
  address: string;            // 远程办公地址
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

/** 校验结果 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/** Agent 工作流状态 */
export enum WorkflowState {
  COLLECTING = 'COLLECTING',
  FILLING_FORM = 'FILLING_FORM',
  VALIDATING = 'VALIDATING',
  AWAITING_CONFIRM = 'AWAITING_CONFIRM',
  SUBMITTING = 'SUBMITTING',
  STARTING_PROCESS = 'STARTING_PROCESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

/** 工作流上下文 */
export interface WorkflowContext {
  state: WorkflowState;
  userInput: string;
  form?: LeaveForm;
  formId?: string;
  processId?: string;
  validationErrors: string[];
  retryCount: number;
  maxRetries: number;
}
