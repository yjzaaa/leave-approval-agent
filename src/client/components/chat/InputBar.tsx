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

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as string;
      if (detail && !disabled) {
        setValue(detail);
        inputRef.current?.focus();
        setTimeout(() => onSend(detail), 100);
      }
    };
    window.addEventListener('suggestion-click', handler);
    return () => window.removeEventListener('suggestion-click', handler);
  }, [disabled, onSend]);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled || trimmed.length > MAX_LENGTH) return;
    onSend(trimmed);
    setValue('');
    inputRef.current?.focus();
  };

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
        {value.length > 0 && (
          <span className="char-count">
            {value.length}/{MAX_LENGTH}
          </span>
        )}
      </div>
      <button
        className="btn-send"
        onClick={handleSend}
        disabled={!canSend}
        aria-label="发送消息"
        title="发送 (Enter)"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M2.5 2.5L17.5 10L2.5 17.5L4.5 10L2.5 2.5Z" fill="currentColor"/>
          <path d="M4.5 10L17.5 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  );
};
