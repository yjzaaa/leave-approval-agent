/** SSE (Server-Sent Events) 事件类型与回调 */

/** SSE 事件回调 — agent 事件到前端的桥接函数 */
export type SSECallback = (event: string, data: Record<string, unknown>) => void;

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
  /** 事件类型 */
  event: SSEEventType;
  /** 事件数据 */
  data: Record<string, unknown>;
}
