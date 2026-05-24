/**
 * Human-in-the-Loop 确认管理器
 *
 * 符合 Pi Agent 代码风格的 HITL 组件：
 *   - 实例化设计（替代全局单例），每个会话一个实例
 *   - 事件驱动（替代轮询），通过 onEvent 回调通知确认状态变化
 *   - 声明式 withConfirm 包装器，插件 tool 无需手动调用 requestConfirm
 *
 * 使用方式：
 *   1. agent-factory 创建 HitlManager 实例，onEvent 驱动 SSE
 *   2. agent-factory 对 plugin.confirmTools 中的 tool 自动包装 withConfirm
 *   3. 插件 tool 只定义业务逻辑，HITL 自动注入
 *   4. 服务端通过 hitl.approve() / hitl.reject() 响应用户操作
 */
import type { AgentTool } from '@earendil-works/pi-agent-core';

/** HITL 事件 */
export type HitlEvent =
  | { type: 'confirm_required'; tool: string; label?: string; form: unknown; fieldLabels?: Record<string, string> }
  | { type: 'confirm_resolved'; tool: string; approved: boolean };

/** HITL 事件回调 */
export type HitlEventCallback = (event: HitlEvent) => void;

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

/**
 * HITL 确认管理器
 *
 * 核心机制：requestConfirm 返回 Promise，tool 执行被挂起；
 * 用户确认/拒绝后 resolve Promise，tool 继续或抛错。
 */
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

/**
 * 包装 AgentTool，在执行前自动注入 HITL 确认
 *
 * @param tool 原始 tool（只含业务逻辑）
 * @param hitl HitlManager 实例
 * @param options.label 确认弹窗标题
 */
export function withConfirm<T extends AgentTool<any>>(
  tool: T,
  hitl: HitlManager,
  options?: { label?: string },
): T {
  const originalExecute = tool.execute;
  return {
    ...tool,
    execute: async (id, params, signal, onUpdate) => {
      const approved = await hitl.requestConfirm(tool.name, params, { label: options?.label });
      if (!approved) throw new Error(`用户拒绝执行「${tool.label}」`);
      return originalExecute(id, params, signal, onUpdate);
    },
  };
}

/**
 * 批量包装 HITL tools
 *
 * 遍历 plugin 的 tools，对 confirmTools 中声明的 tool 注入 HITL
 */
export function wrapHitlTools(
  tools: AgentTool<any>[],
  hitl: HitlManager,
  confirmTools: string[],
  confirmLabels?: Record<string, string>,
): AgentTool<any>[] {
  const set = new Set(confirmTools);
  return tools.map(tool => {
    if (set.has(tool.name)) {
      return withConfirm(tool, hitl, { label: confirmLabels?.[tool.name] });
    }
    return tool;
  });
}
