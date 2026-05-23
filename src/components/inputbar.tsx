import React, { useState, useRef } from 'react';

interface Props {
  onSend: (message: string) => void;
  disabled: boolean;
}

export const InputBar: React.FC<Props> = ({ onSend, disabled }) => {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
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

  return (
    <div className="input-bar">
      <input
        ref={inputRef}
        type="text"
        placeholder="描述你的远程办公需求，例如：家人住院需要照顾3天..."
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        autoFocus
      />
      <button onClick={handleSend} disabled={disabled || !value.trim()}>
        发送
      </button>
    </div>
  );
};
