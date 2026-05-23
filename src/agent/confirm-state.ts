/**
 * Human-in-the-Loop 确认状态机
 *
 * 独立于具体业务，管理"用户确认"这一通用交互模式。
 *
 * 使用方式：
 *   1. Tool 执行前调用 requestConfirm() 注册确认，返回 Promise
 *   2. SSE 层轮询 getPending() 检测是否有待确认项
 *   3. 用户确认/拒绝后调用 approveConfirm() / rejectConfirm()
 *   4. Tool 中的 Promise resolve，继续或终止
 *
 * 去重策略：同一时刻只存在一个待确认项，新请求会覆盖旧请求（自动拒绝旧的）。
 */
import type { PendingConfirm } from './types.js';

let pending: PendingConfirm | null = null;

/** 超时自动拒绝时间（默认 120 秒） */
const DEFAULT_TIMEOUT_MS = 120_000;

/**
 * 注册一个待确认请求
 * @returns Promise<boolean> — true=用户确认, false=用户拒绝/超时
 */
export function requestConfirm(
  tool: string,
  data: unknown,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<boolean> {
  console.log(`[ConfirmState] requestConfirm tool=${tool}, data keys:`, Object.keys((data as any) || {}));

  // 覆盖旧请求：防止残留的未确认请求堆积
  if (pending) {
    console.log('[ConfirmState] overriding stale pending');
    pending.resolve(false);
    clearTimeout(pending.timer);
  }

  return new Promise<boolean>(resolve => {
    pending = {
      resolve,
      tool,
      data,
      timer: setTimeout(() => {
        console.log(`[ConfirmState] timeout for ${tool}`);
        pending = null;
        resolve(false);
      }, timeoutMs),
    };
    console.log('[ConfirmState] awaiting user decision...');
  });
}

/** 获取当前待确认项（供 SSE 轮询层读取） */
export function getPending(): PendingConfirm | null {
  return pending;
}

/** 用户确认 */
export function approveConfirm(): boolean {
  if (!pending) return false;
  clearTimeout(pending.timer);
  pending.resolve(true);
  pending = null;
  return true;
}

/** 用户拒绝 */
export function rejectConfirm(): boolean {
  if (!pending) return false;
  clearTimeout(pending.timer);
  pending.resolve(false);
  pending = null;
  return true;
}

/** 重置确认状态（Agent 重置时调用） */
export function resetConfirm(): void {
  if (pending) {
    clearTimeout(pending.timer);
    pending.resolve(false);
  }
  pending = null;
}
