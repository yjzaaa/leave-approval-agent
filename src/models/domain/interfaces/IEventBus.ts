/**
 * Agent 会话事件总线接口 — 替代 onSSE 回调链
 *
 * 每个 Agent 会话一个实例，请求级生命周期。
 * Express 路由创建实例并订阅，各组件通过 emit() 发布事件。
 */

/** Agent 会话事件映射（类型安全的 emit/on） */
export interface AgentEventMap {
  text:             { content: string };
  tool_result:      { tool: string; isError?: boolean };
  content:          { blocks: Array<{ type: string; data: Record<string, unknown> }> };
  done:             Record<string, never>;
  error:            { message: string };
  confirm_required: { tool: string; label: string; form: Record<string, string>; fieldLabels: Record<string, string> };
  confirm_resolved: { tool: string };
}

/** 类型安全的事件总线接口 — 每个 Agent 会话一个实例 */
export interface IAgentEventBus {
  /** 发布事件 */
  emit<K extends keyof AgentEventMap>(event: K, data: AgentEventMap[K]): void;
  /** 订阅事件，返回取消订阅函数 */
  on<K extends keyof AgentEventMap>(event: K, handler: (data: AgentEventMap[K]) => void): () => void;
  /** 销毁总线，移除所有监听器 */
  destroy(): void;
}
