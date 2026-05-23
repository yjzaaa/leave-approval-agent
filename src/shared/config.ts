/**
 * 共享层 — 全局配置
 * 从环境变量加载，被 server 层引用
 */
import 'dotenv/config';

export const config = {
  /** 最大表单修正重试次数（LLM 自主修复校验错误的上限） */
  maxFormRetries: parseInt(process.env.MAX_FORM_RETRIES ?? '5', 10),
};
