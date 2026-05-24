import React, { useRef, useEffect, useState, useCallback } from 'react';
import { MessageSquare, ChevronDown } from 'lucide-react';
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
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'auto' });
  }, []);

  const handleGoToBottom = useCallback(() => {
    autoScrollRef.current = true;
    setShowScrollBtn(false);
    scrollToBottom();
  }, [scrollToBottom]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let prevDistance = 0;
    const onScroll = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      // 滞后区间: 距底部 < 50px 隐藏, > 150px 显示, 中间保持不动
      if (distance < 50) {
        autoScrollRef.current = true;
        setShowScrollBtn(false);
      } else if (distance > 150) {
        autoScrollRef.current = false;
        setShowScrollBtn(true);
      }
      prevDistance = distance;
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
    <div className="relative flex-1 overflow-y-auto px-4 py-4 custom-scrollbar scroll-smooth" ref={containerRef} role="log" aria-label="对话记录" aria-live="polite">
      {isEmpty ? (
        <div className="flex flex-col items-center justify-center h-full text-center gap-4 max-w-3xl mx-auto">
          <MessageSquare className="h-12 w-12 text-muted-foreground/30" aria-hidden="true" />
          <h3 className="text-lg font-semibold tracking-tight">审批助手</h3>
          <p className="text-sm text-muted-foreground max-w-sm">描述您的需求，助手会帮您填写申请、校验信息并提交审批。</p>
          {suggestions && suggestions.length > 0 && (
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              {suggestions.map(s => (
                <button key={s} className="px-3 py-1.5 text-sm rounded-xl border border-border hover:bg-accent hover:border-primary/30 transition-colors"
                  onClick={() => window.dispatchEvent(new CustomEvent('suggestion-click', { detail: s }))}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="max-w-3xl mx-auto">
          {messages.map(msg => <MessageBubble key={msg.id} message={msg} />)}
        </div>
      )}
      <div ref={bottomRef} />
      <div className="sticky bottom-0 flex justify-center py-2 -mt-10 pointer-events-none">
        <button
          className={[
            'rounded-full h-9 w-9 shadow-md bg-background border border-border flex items-center justify-center pointer-events-auto',
            'transition-all duration-200',
            showScrollBtn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none',
          ].join(' ')}
          onClick={handleGoToBottom}
          aria-label="回到底部"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
