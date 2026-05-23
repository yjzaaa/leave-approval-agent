import React from 'react';
import type { Message } from '../client-types';

interface Props {
  message: Message;
}

function formatContent(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br/>')
    .replace(/^-\s(.+)$/gm, '• $1');
}

export const MessageBubble: React.FC<Props> = ({ message }) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <div className="msg system">
        <span dangerouslySetInnerHTML={{ __html: formatContent(message.content) }} />
      </div>
    );
  }

  return (
    <div className={`msg ${isUser ? 'user' : 'assistant'}`}>
      <div className={`avatar ${isUser ? 'user' : 'bot'}`}>
        {isUser ? '👤' : '🤖'}
      </div>
      <div className="bubble">
        {message.content ? (
          <span dangerouslySetInnerHTML={{ __html: formatContent(message.content) }} />
        ) : (
          <span className="typing">思考中<span className="dots"><span>.</span><span>.</span><span>.</span></span></span>
        )}
      </div>
    </div>
  );
};
