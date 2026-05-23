/**
 * ChatContainer — 聊天消息列表容器
 */
import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { Message } from '../../types';
import { MessageBubble } from './MessageBubble';

interface Props {
  messages: Message[];
  suggestions?: string[];
}

export const ChatContainer: React.FC<Props> = ({ messages, suggestions }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const userScrolledUpRef = useRef(false);

  /** 滚动到底部 */
  const scrollToBottom = useCallback((smooth = false) => {
    sentinelRef.current?.scrollIntoView({
      behavior: smooth ? 'smooth' : 'auto',
      block: 'end',
    });
  }, []);

  /** 判断用户是否在底部附近（容差 60px） */
  const isNearBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  }, []);

  // 用户手动滚动时记录是否离开底部
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleScroll = () => {
      const near = isNearBottom();
      setShowScrollBtn(!near);
      userScrolledUpRef.current = !near;
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [isNearBottom]);

  // 消息变化时：如果用户在底部，自动跟随；否则不动
  useEffect(() => {
    if (!userScrolledUpRef.current) {
      scrollToBottom(false);
    }
  }, [messages, scrollToBottom]);

  // 首次加载和插件切换后强制滚到底部
  useEffect(() => {
    userScrolledUpRef.current = false;
    scrollToBottom(false);
  }, []);

  const isEmpty = messages.length === 0;

  return (
    <div
      className="chat-container"
      ref={containerRef}
      role="log"
      aria-label="对话记录"
      aria-live="polite"
    >
      {isEmpty ? (
        <div className="chat-empty">
          <div className="chat-empty-icon" aria-hidden="true">💬</div>
          <h3>审批助手</h3>
          <p>描述您的需求，助手会帮您填写申请、校验信息并提交审批。</p>
          {suggestions && suggestions.length > 0 && (
            <div className="chat-empty-suggestions">
              {suggestions.map(s => (
                <button
                  key={s}
                  className="chat-empty-suggestion"
                  onClick={() =>
                    window.dispatchEvent(new CustomEvent('suggestion-click', { detail: s }))
                  }
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))
      )}

      {/* 滚动锚点 sentinel — 替代 bottomRef */}
      <div ref={sentinelRef} style={{ height: 1, flexShrink: 0 }} />

      {/* 回到底部按钮（固定定位，始终可见） */}
      {showScrollBtn && (
        <button
          className="scroll-bottom-btn"
          onClick={() => {
            userScrolledUpRef.current = false;
            scrollToBottom(true);
          }}
          aria-label="滚动到底部"
        >
          ↓
        </button>
      )}
    </div>
  );
};
