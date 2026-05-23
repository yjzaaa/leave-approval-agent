/**
 * InputBar — 消息输入框
 *
 * 功能：
 * 1. 文本输入 + Enter 发送
 * 2. 字数计数（上限 500 字）
 * 3. 快捷建议联动 — 监听 ChatContainer 的 suggestion-click 事件自动填入
 * 4. 发送中禁用输入
 */
import React, { useState, useRef, useEffect } from 'react';

interface Props {
  onSend: (message: string) => void;
  disabled: boolean;
}

const MAX_LENGTH = 500;
const PLACEHOLDER = '描述你的远程办公需求，例如：家人住院需要照顾...';

export const InputBar: React.FC<Props> = ({ onSend, disabled }) => {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // 监听 ChatContainer 发出的快捷建议事件
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as string;
      if (detail && !disabled) {
        setValue(detail);
        inputRef.current?.focus();
        // 自动发送快捷建议
        setTimeout(() => onSend(detail), 100);
      }
    };
    window.addEventListener('suggestion-click', handler);
    return () => window.removeEventListener('suggestion-click', handler);
  }, [disabled, onSend]);

  /** 发送消息 */
  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled || trimmed.length > MAX_LENGTH) return;
    onSend(trimmed);
    setValue('');
    inputRef.current?.focus();
  };

  /** Enter 发送，Shift+Enter 换行（未实现多行，预留） */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = value.trim().length > 0 && !disabled;

  return (
    <div className="input-bar">
      <div className="input-wrapper">
        <input
          ref={inputRef}
          type="text"
          placeholder={disabled ? '请稍候...' : PLACEHOLDER}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className={value ? 'has-value' : ''}
          maxLength={MAX_LENGTH + 50}
          aria-label="输入消息"
          autoFocus
        />
        {/* 字数计数 */}
        {value.length > 0 && (
          <span className="char-count">
            {value.length}/{MAX_LENGTH}
          </span>
        )}
      </div>

      {/* 发送按钮 — SVG 纸飞机图标 */}
      <button
        className="btn-send"
        onClick={handleSend}
        disabled={!canSend}
        aria-label="发送消息"
        title="发送 (Enter)"
      >
        <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M2.5 2.5L17.5 10L2.5 17.5L4.5 10L2.5 2.5Z" fill="currentColor"/>
          <path d="M4.5 10L17.5 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  );
};
