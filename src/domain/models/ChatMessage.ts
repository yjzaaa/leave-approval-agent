/**
 * 聊天消息（用于历史记录）
 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}
