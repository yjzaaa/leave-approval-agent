import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { Message } from '../../types';
import { MessageBubble } from './MessageBubble';

interface Props {
  messages: Message[];
}

const SUGGESTIONS = [
  '我需要申请远程办公',
  '家人住院需要照顾',
  '身体不适在家办公',
];

export const ChatContainer: React.FC<Props> = ({ messages }) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 150);
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  const isEmpty = messages.length === 0;

  const handleSuggestionClick = (text: string) => {
    window.dispatchEvent(new CustomEvent('suggestion-click', { detail: text }));
  };

  return (
    <div className="chat-container" ref={containerRef} role="log" aria-label="对话记录" aria-live="polite">
      {isEmpty ? (
        <div className="chat-empty">
          <div className="chat-empty-icon" aria-hidden="true">💬</div>
          <h3>远程办公审批助手</h3>
          <p>描述你的远程办公需求，我会帮你填写申请、校验信息并提交审批。</p>
          <div className="chat-empty-suggestions">
            {SUGGESTIONS.map(s => (
              <button
                key={s}
                className="chat-empty-suggestion"
                onClick={() => handleSuggestionClick(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : (
        messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))
      )}

      {showScrollBtn && (
        <button
          className="scroll-bottom-btn"
          onClick={scrollToBottom}
          aria-label="滚动到底部"
          title="滚动到底部"
        >
          ↓
        </button>
      )}

      <div ref={bottomRef} />
    </div>
  );
};
