import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { Message } from '../../types';
import { MessageBubble } from './MessageBubble';

interface Props {
  messages: Message[];
  suggestions?: string[];
}

export const ChatContainer: React.FC<Props> = ({ messages, suggestions }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const prevCountRef = useRef(0);
  const autoScrollRef = useRef(true);

  const scrollToBottom = useCallback(() => {
    const el = containerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  const handleGoToBottom = useCallback(() => {
    autoScrollRef.current = true;
    setShowScrollBtn(false);
    scrollToBottom();
  }, [scrollToBottom]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      if (!atBottom && autoScrollRef.current) {
        autoScrollRef.current = false;
        setShowScrollBtn(true);
      }
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (messages.length > prevCountRef.current) {
      if (autoScrollRef.current) {
        const id = requestAnimationFrame(() => {
          if (autoScrollRef.current) scrollToBottom();
        });
        return () => cancelAnimationFrame(id);
      }
    }
    prevCountRef.current = messages.length;
  }, [messages.length, scrollToBottom]);

  useEffect(() => {
    prevCountRef.current = messages.length;
    scrollToBottom();
  }, []);

  const isEmpty = messages.length === 0;

  return (
    <div className="chat-container" ref={containerRef} role="log" aria-label="对话记录" aria-live="polite">
      {isEmpty ? (
        <div className="chat-empty">
          <div className="chat-empty-icon" aria-hidden="true">💬</div>
          <h3>审批助手</h3>
          <p>描述您的需求，助手会帮您填写申请、校验信息并提交审批。</p>
          {suggestions && suggestions.length > 0 && (
            <div className="chat-empty-suggestions">
              {suggestions.map(s => (
                <button key={s} className="chat-empty-suggestion"
                  onClick={() => window.dispatchEvent(new CustomEvent('suggestion-click', { detail: s }))}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        messages.map(msg => <MessageBubble key={msg.id} message={msg} />)
      )}
      <div ref={bottomRef} />
      {showScrollBtn && (
        <button className="scroll-bottom-btn" onClick={handleGoToBottom} aria-label="回到底部">↓</button>
      )}
    </div>
  );
};
