import React, { useRef, useEffect } from 'react';
import type { Message } from '../client-types';
import { MessageBubble } from './MessageBubble';

interface Props {
  messages: Message[];
}

export const ChatContainer: React.FC<Props> = ({ messages }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="chat-container">
      {messages.map(msg => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
};
