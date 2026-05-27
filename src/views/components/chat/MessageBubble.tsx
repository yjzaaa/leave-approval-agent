import React from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message } from '../../types';
import { ContentRenderer } from '../content-renderer';
import type { ContentBlockData } from '../content-renderer';

interface Props { message: Message; }

function formatTime(ts: number | undefined, locale: string): string {
  if (!ts) return '';
  try {
    const date = new Date(ts);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const time = date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    return isToday ? time : `${date.toLocaleDateString(locale, { month: 'short', day: 'numeric' })} ${time}`;
  } catch { return ''; }
}

export const MessageBubble: React.FC<Props> = ({ message }) => {
  const { t, i18n } = useTranslation();
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const isLoading = message.role === 'assistant' && !message.content;

  if (isSystem) {
    return (
      <div className="flex justify-center" role="status">
        <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">{message.content}</span>
      </div>
    );
  }

  const time = formatTime(message.timestamp, i18n.language);

  if (isUser) {
    return (
      <div className="flex justify-end px-2 mb-4" role="article" aria-label={t('message.ariaUser')}>
        <div className="flex flex-col items-end gap-0 min-w-0">
          <div className="bg-primary text-primary-foreground rounded-2xl px-5 py-2.5 max-w-[75%] text-sm leading-relaxed break-words">
            <div className="msg-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown></div>
          </div>
          {time && (
            <time className="text-[10px] text-muted-foreground/60 mt-1" dateTime={new Date(message.timestamp).toISOString()}>{time}</time>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 px-2 mb-4" role="article" aria-label={t('message.ariaAssistant')}>
      <div className="h-8 w-8 rounded-full bg-secondary/15 text-secondary flex items-center justify-center text-xs font-medium shrink-0" aria-hidden="true">
        AI
      </div>
      <div className="flex flex-col gap-0 min-w-0">
        {isLoading ? (
          <span className="flex gap-1.5 items-center px-5 py-2.5" aria-label={t('message.ariaTyping')}>
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }} />
          </span>
        ) : (
          <div className="bg-secondary text-secondary-foreground rounded-2xl px-5 py-2.5 max-w-[75%] text-sm leading-relaxed break-words">
            <div className="msg-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown></div>
            {message.contentBlocks && message.contentBlocks.length > 0 && (
              <ContentRenderer blocks={message.contentBlocks as ContentBlockData[]} />
            )}
          </div>
        )}
        {time && (
          <time className="text-[10px] text-muted-foreground/60 mt-1 ml-1" dateTime={new Date(message.timestamp).toISOString()}>{time}</time>
        )}
      </div>
    </div>
  );
};
