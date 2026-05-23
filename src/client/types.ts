/**
 * 前端专用类型定义
 * 与 shared/types.ts 分离：shared 放领域类型，client 放 UI 相关类型
 */

/** 聊天消息 */
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

/** 确认请求数据（由 SSE confirm_required 事件推送） */
export interface ConfirmRequest {
  tool: 'submit_form' | 'start_process';
  label: string;
  form: Record<string, string>;
  fieldLabels: Record<string, string>;
}

/** Agent 工作阶段 */
export type AgentPhase =
  | 'idle'        // 就绪，等待用户输入
  | 'thinking'    // Agent 正在分析思考
  | 'filling'     // 正在填写表单
  | 'validating'  // 正在校验表单
  | 'confirming'  // 等待用户确认
  | 'done'        // 流程结束
  | 'error';      // 出错

/** 全局 Agent 状态 */
export interface AgentState {
  messages: Message[];
  phase: AgentPhase;
  phaseText: string;
  confirmRequest: ConfirmRequest | null;
  isStreaming: boolean;
  error: string | null;
}
