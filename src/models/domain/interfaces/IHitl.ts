/** HITL (Human-in-the-Loop) 事件与回调类型 */

/** HITL 事件 */
export type HitlEvent =
  | { type: 'confirm_required'; tool: string; label?: string; form: unknown; fieldLabels?: Record<string, string> }
  | { type: 'confirm_resolved'; tool: string; approved: boolean };

/** HITL 事件回调 */
export type HitlEventCallback = (event: HitlEvent) => void;
