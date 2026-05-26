/** 追踪器接口 — MLflow/其他追踪服务的抽象契约 */

/** 追踪器创建选项 */
export interface TracerOptions {
  /** 场景 ID */
  scenario: string;
  /** 用户 ID */
  userId?: string;
  /** 会话 ID */
  sessionId?: string;
  /** 用户消息 */
  message: string;
}

/** 追踪器接口 — 所有 tracer 实现必须满足 */
export interface ITracer {
  /** 执行完整 trace 生命周期，返回 fn 的结果 */
  run<T>(fn: () => Promise<T>): Promise<T>;
  /** 接收 agent 事件 */
  handleEvent(event: {
    type: string;
    toolName?: string;
    isError?: boolean;
    errorMessage?: string;
    args?: unknown;
    result?: unknown;
    assistantMessageEvent?: { type: string; delta?: string };
  }): void;
  /** 标记 HITL 触发 */
  markHitl(toolName: string): void;
}
