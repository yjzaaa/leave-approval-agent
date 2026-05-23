/** 前端消息类型 */
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

/** 确认请求数据 */
export interface ConfirmRequest {
  tool: 'submit_form' | 'start_process';
  label: string;
  form: Record<string, string>;
  fieldLabels: Record<string, string>;
}

/** Agent 工作阶段 */
export type AgentPhase = 'idle' | 'thinking' | 'filling' | 'validating' | 'confirming' | 'done' | 'error';

/** 全局 Agent 状态 */
export interface AgentState {
  messages: Message[];
  phase: AgentPhase;
  phaseText: string;
  confirmRequest: ConfirmRequest | null;
  isStreaming: boolean;
  error: string | null;
}
