/**
 * ChatContainer — 聊天消息列表容器
 *
 * 功能：
 * 1. 空状态展示 — 根据插件 suggestions 动态显示快捷建议
 * 2. 消息列表渲染 — 逐条渲染 MessageBubble
 * 3. 自动滚动到底 — 新消息到达时自动滚动
 * 4. 滚动偏离提示 — 用户上翻历史时显示"回到底部"按钮
 * 5. 快捷建议联动 — 点击建议通过自定义事件通知 InputBar
 */
import React, { useRef, useEffect, useState } from 'react';
import type { Message } from '../../types';
import { MessageBubble } from './MessageBubble';

interface Props {
  messages: Message[];
  /** 空状态快捷建议语（来自当前插件） */
  suggestions?: string[];
}

export const ChatContainer: React.FC<Props> = ({ messages, suggestions }) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  /** 滚动到消息列表底部 */
  const scrollToBottom = () => bottomRef.current?.scrollIntoView({ behavior: 'smooth' });

  // 新消息到达时自动滚动
  useEffect(() => { scrollToBottom(); }, [messages]);

  // 监听滚动位置，偏离超过 150px 时显示"回到底部"按钮
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

  /** 点击快捷建议：通过自定义事件通知 InputBar */
  const handleSuggestionClick = (text: string) => {
    window.dispatchEvent(new CustomEvent('suggestion-click', { detail: text }));
  };

  return (
    <div className="chat-container" ref={containerRef} role="log" aria-label="对话记录" aria-live="polite">
      {/* 空状态 */}
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
                  onClick={() => handleSuggestionClick(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* 消息列表 */
        messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))
      )}

      {/* 回到底部按钮 */}
      {showScrollBtn && (
        <button className="scroll-bottom-btn" onClick={scrollToBottom} aria-label="滚动到底部">↓</button>
      )}

      <div ref={bottomRef} />
    </div>
  );
};
