import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Send } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Tooltip } from '../ui/Tooltip';

interface Props {
  onSend: (message: string) => void;
  disabled: boolean;
}

const MAX_LENGTH = 500;

export const InputBar: React.FC<Props> = ({ onSend, disabled }) => {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
    <div className="border-t border-border bg-background p-4">
      <div className="flex items-end gap-3 max-w-3xl mx-auto">
        <textarea
          ref={inputRef}
          rows={1}
          placeholder={disabled ? t('input.placeholderDisabled') : t('input.placeholder')}
          value={value}
          onChange={e => setValue(e.target.value.replace(/[\r\n]+/g, ''))}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className="flex-1 resize-none rounded-2xl border border-input bg-accent px-4 py-3 text-sm min-h-[48px] max-h-[200px] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          maxLength={MAX_LENGTH + 50}
          aria-label={t('input.ariaInput')}
          autoFocus
        />
        {value.length > 0 && (
          <span className="text-xs text-muted-foreground self-center mb-2">
            {value.length}/{MAX_LENGTH}
          </span>
        )}
        <Tooltip text={t('input.sendTooltip')}>
          <Button
            variant="default"
            size="icon"
            className="rounded-full h-10 w-10 shrink-0"
            onClick={handleSend}
            disabled={!canSend}
            aria-label={t('input.ariaSend')}
          >
          <Send className="h-4 w-4" />
        </Button>
        </Tooltip>
      </div>
    </div>
  );
};
