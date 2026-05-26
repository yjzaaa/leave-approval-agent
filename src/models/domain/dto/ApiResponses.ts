/**
 * API 响应 DTO
 */

/** 表单提交结果（通用，所有场景 submitApi 共用） */
export interface SubmitResult {
  success: boolean;
  resultId?: string;
  message?: string;
  form?: Record<string, string>;
}

/** 流程发起结果（通用，所有场景 startProcessApi 共用） */
export interface StartProcessResult {
  success: boolean;
  processId?: string;
  message?: string;
}

/** 表单提交结果（旧版，保留兼容） */
export interface FormSubmitResult {
  success: boolean;
  formId?: string;
  form?: Record<string, string>;
  errors?: string[];
}

/** 流程发起结果（旧版，保留兼容） */
export interface ProcessResult {
  success: boolean;
  processId?: string;
  message?: string;
  error?: string;
}

/** API 错误响应 */
export interface ApiErrorResponse {
  error: string;
}

/** HITL 确认响应 */
export interface ConfirmResponse {
  ok: boolean;
  message: string;
}

/** 对话压缩响应 */
export interface CompactResponse {
  summary: string;
}

/** 记忆提取响应 */
export interface ExtractMemoriesResponse {
  user: string[];
  feedback: string[];
  project: string[];
  reference: string[];
}
