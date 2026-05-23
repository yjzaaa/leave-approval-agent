/**
 * API 客户端 - 统一出口，可切换 mock / real
 */
import type { LeaveForm, FormSubmitResult, ProcessResult } from '../types.js';
import * as mock from './mock.js';

// 当前使用 mock 实现；生产环境替换为真实 HTTP 调用
export const apiClient = {
  submitForm: mock.submitForm,
  startProcess: mock.startProcess,
};

// 类型导出供外部使用
export type { FormSubmitResult, ProcessResult };
