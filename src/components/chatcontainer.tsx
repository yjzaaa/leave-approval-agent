import React, { useRef, useEffect } from 'react';
import type { Message, ConfirmRequest } from '../client-types';
import { MessageBubble } from './MessageBubble';
import { ConfirmCard } from './ConfirmCard';

interface Props {
  messages: Message[];
  confirmRequest: ConfirmRequest | null;
  onConfirm: (approved: boolean) => void;
}

export const ChatContainer: React.FC<Props> = ({ messages, confirmRequest, onConfirm }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, confirmRequest]);

  return (
    <div className="chat-container">
      {messages.map(msg => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      {confirmRequest && (
        <ConfirmCard confirmRequest={confirmRequest} onConfirm={onConfirm} />
      )}
      <div ref={bottomRef} />
    </div>
  );
};
