/**
 * Agent 运行时常量
 */
import { envInt } from '../utils/env.js';

export const config = {
  /** 最大表单修正重试次数（LLM 自主修复校验错误的上限） */
  maxFormRetries: envInt('MAX_FORM_RETRIES', 5),
};
