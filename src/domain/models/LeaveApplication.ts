/**
 * 远程办公申请表单
 */
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
