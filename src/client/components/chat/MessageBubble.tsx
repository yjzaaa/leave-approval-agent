import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message } from '../../types';

interface Props {
  message: Message;
}

/** Format time from timestamp */
function formatTime(isoString?: string): string {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const time = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    return isToday ? time : `${date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })} ${time}`;
  } catch {
    return '';
  }
}

export const MessageBubble: React.FC<Props> = ({ message }) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const isLoading = message.role === 'assistant' && !message.content;

  if (isSystem) {
    return (
      <div className="msg system" role="status">
        {message.content}
      </div>
    );
  }

  const time = formatTime(message.id);

  return (
    <div
      className={`msg ${isUser ? 'user' : 'assistant'}`}
      role="article"
      aria-label={`${isUser ? '你' : '助手'}的消息`}
    >
      <div className={`avatar ${isUser ? 'user' : 'bot'}`} aria-hidden="true">
        {isUser ? '👤' : '🤖'}
      </div>

      <div className="bubble-wrapper">
        <div className="bubble">
          {isLoading ? (
            <div className="typing-indicator" aria-label="正在输入...">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          )}
        </div>
        {time && (
          <time className="msg-time" dateTime={message.id}>
            {time}
          </time>
        )}
      </div>
    </div>
  );
};
