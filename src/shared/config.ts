/**
 * 共享层 — 全局配置
 *
 * Node.js 环境: process.env 由 dotenv 注入（server 入口加载）
 * 浏览器环境: process.env 由 Vite define 注入（构建时替换为字面量）
 *
 * 本文件不再 import dotenv，由各运行环境自行负责 env 加载。
 */

function envInt(key: string, fallback: number): number {
  try {
    const v = (typeof process !== 'undefined' ? process.env?.[key] : undefined) ?? String(fallback);
    return parseInt(v, 10);
  } catch { return fallback; }
}

export const config = {
  /** 最大表单修正重试次数（LLM 自主修复校验错误的上限） */
  maxFormRetries: envInt('MAX_FORM_RETRIES', 5),
};
