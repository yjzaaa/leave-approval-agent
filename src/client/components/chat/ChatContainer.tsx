/**
 * ChatContainer — 聊天消息列表容器
 *
 * 滚动策略：
 *   - 默认自动滚到底部（跟随新消息）
 *   - 用户上翻 > 60px 后停止自动跟随
 *   - 点击"回到底部"按钮恢复自动跟随
 *   - 消息内容高度变化时（Markdown渲染完成），如果在底部则继续跟随
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
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const shouldAutoScrollRef = useRef(true);
  const prevMessageCountRef = useRef(0);

  /** 立即滚到底部（无动画） */
  const scrollToBottomInstant = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  /** 平滑滚到底部 */
  const scrollToBottomSmooth = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, []);

  /** 回到对话末尾：恢复自动跟随 + 平滑滚动 */
  const goToBottom = useCallback(() => {
    shouldAutoScrollRef.current = true;
    setShowScrollBtn(false);
    scrollToBottomInstant();
  }, [scrollToBottomInstant]);

  // 监听用户滚动：判断是否离开了底部
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onScroll = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (distance > 60) {
        // 用户手动上翻了
        shouldAutoScrollRef.current = false;
        setShowScrollBtn(true);
      } else {
        // 用户回到或接近底部
        shouldAutoScrollRef.current = true;
        setShowScrollBtn(false);
      }
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // 新消息到达时自动滚动
  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      // requestAnimationFrame 确保 DOM 已更新
      requestAnimationFrame(() => {
        if (shouldAutoScrollRef.current) {
          scrollToBottomInstant();
        }
      });
    }
    prevMessageCountRef.current = messages.length;
  }, [messages, scrollToBottomInstant]);

  // 初始化时滚到底部
  useEffect(() => {
    shouldAutoScrollRef.current = true;
    scrollToBottomInstant();
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
        messages.map(msg => <MessageBubble key={msg.id} message={msg} />)
      )}

      <div ref={bottomRef} />

      {showScrollBtn && (
        <button className="scroll-bottom-btn" onClick={goToBottom} aria-label="回到底部">
          ↓
        </button>
      )}
    </div>
  );
};
