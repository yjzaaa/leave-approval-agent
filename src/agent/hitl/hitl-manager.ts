/**
 * HITL 确认管理器 — 状态机核心
 *
 * 核心机制：requestConfirm 返回 Promise，tool 执行被挂起；
 * 用户确认/拒绝后 resolve Promise，tool 继续或抛错。
 */
import type { HitlEventCallback } from '../../models/domain/interfaces/IHitl.js';

/** 待确认项 */
interface PendingConfirm {
  resolve: (approved: boolean) => void;
  tool: string;
  data: unknown;
  label?: string;
  timer: ReturnType<typeof setTimeout>;
}

/** 超时自动拒绝时间（默认 120 秒） */
const DEFAULT_TIMEOUT_MS = 120_000;

/** HITL 确认管理器 — 每个会话一个实例 */
export class HitlManager {
  private _pending: PendingConfirm | null = null;
  private readonly onEvent: HitlEventCallback;

  constructor(options: { onEvent: HitlEventCallback }) {
    this.onEvent = options.onEvent;
  }

  /** 当前待确认项（只读） */
  get pending(): PendingConfirm | null {
    return this._pending;
  }

  /**
   * 注册待确认请求，返回 Promise 挂起 tool 执行
   * @returns true=用户确认, false=用户拒绝/超时
   */
  requestConfirm(
    tool: string,
    data: unknown,
    options?: { label?: string; timeoutMs?: number },
  ): Promise<boolean> {
    const { label, timeoutMs = DEFAULT_TIMEOUT_MS } = options ?? {};

    // 覆盖旧请求
    if (this._pending) {
      this._pending.resolve(false);
      clearTimeout(this._pending.timer);
    }

    return new Promise<boolean>(resolve => {
      this._pending = {
        resolve,
        tool,
        data,
        label,
        timer: setTimeout(() => {
          this._pending = null;
          this.onEvent({ type: 'confirm_resolved', tool, approved: false });
          resolve(false);
        }, timeoutMs),
      };

      this.onEvent({
        type: 'confirm_required',
        tool,
        label,
        form: data,
      });
    });
  }

  /** 用户确认 */
  approve(): boolean {
    if (!this._pending) return false;
    const { resolve, tool, timer } = this._pending;
    clearTimeout(timer);
    this._pending = null;
    this.onEvent({ type: 'confirm_resolved', tool, approved: true });
    resolve(true);
    return true;
  }

  /** 用户拒绝 */
  reject(): boolean {
    if (!this._pending) return false;
    const { resolve, tool, timer } = this._pending;
    clearTimeout(timer);
    this._pending = null;
    this.onEvent({ type: 'confirm_resolved', tool, approved: false });
    resolve(false);
    return true;
  }

  /** 重置确认状态 */
  reset(): void {
    if (this._pending) {
      this._pending.resolve(false);
      clearTimeout(this._pending.timer);
    }
    this._pending = null;
  }
}
