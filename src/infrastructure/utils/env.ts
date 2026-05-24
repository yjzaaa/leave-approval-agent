/**
 * 环境变量工具函数
 */

/** 安全读取环境变量为整数 */
export function envInt(key: string, fallback: number): number {
  try {
    const v = (typeof process !== 'undefined' ? process.env?.[key] : undefined) ?? String(fallback);
    return parseInt(v, 10);
  } catch { return fallback; }
}
