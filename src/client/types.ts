/**
 * 前端专用类型定义 — v3.0 插件化版本
 *
 * 与具体业务解耦：
 *   - ConfirmRequest.tool 不再限定为 'submit_form' | 'start_process'
 *   - AgentPhase 不再包含 filling/validating 等业务特定阶段
 *   - 字段标签由后端插件动态提供，不再前端硬编码
 */

/** 聊天消息 */
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

/**
 * 确认请求（由 SSE confirm_required 推送）
 *
 * tool 字段不再限定值，可以是任何插件的任何确认 Tool。
 * fieldLabels 由后端插件动态提供，驱动 ConfirmCard 渲染。
 */
export interface ConfirmRequest {
  tool: string;
  label: string;
  form: Record<string, string>;
  fieldLabels: Record<string, string>;
}

/**
 * Agent 工作阶段 — 泛化版本
 *
 * 不再包含 filling/validating 等业务特定阶段。
 * 状态切换由 SSE tool_result 事件驱动，StatusBar 根据插件 pipeline 动态渲染。
 */
export type AgentPhase =
  | 'idle'              // 就绪，等待用户输入
  | 'processing'        // Agent 工作中（替代 thinking/filling/validating）
  | 'awaiting_confirm'  // 等待用户确认（由 confirm_required 触发）
  | 'done'              // 流程结束（由 done 事件触发）
  | 'error';            // 出错（由 error 事件触发）

/** Agent 全局状态 */
export interface AgentState {
  messages: Message[];
  phase: AgentPhase;
  phaseText: string;
  confirmRequest: ConfirmRequest | null;
  isStreaming: boolean;
  error: string | null;
}

/** 可用插件信息（来自 GET /api/plugins） */
export interface PluginInfo {
  id: string;
  displayName: string;
  fieldCount: number;
}

/** 聊天历史 (按用户持久化) */
export interface ChatHistory {
  messages: Message[];
  activePluginId: string;
  lastActiveAt: number;
}
