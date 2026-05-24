/**
 * Agent 框架层类型定义
 *
 * 与具体业务无关的通用类型。
 * 业务特定类型定义在 domain/interfaces/ 和各 scenario 中。
 */
import type { Scenario } from '../../domain/interfaces/IScenario.js';

/** 待确认项 */
export interface PendingConfirm {
  resolve: (approved: boolean) => void;
  tool: string;
  data: unknown;
  timer: ReturnType<typeof setTimeout>;
}

/** SSE 事件类型 */
export type SSEEventType =
  | 'text'
  | 'tool_result'
  | 'confirm_required'
  | 'confirm_resolved'
  | 'done'
  | 'error';

/** SSE 事件负载 */
export interface SSEPayload {
  event: SSEEventType;
  data: Record<string, unknown>;
}

/** Agent 创建参数 */
export interface CreateAgentParams {
  scenario: Scenario;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}
