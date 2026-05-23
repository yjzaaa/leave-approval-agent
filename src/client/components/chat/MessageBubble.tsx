/**
 * MessageBubble — 单条消息气泡
 *
 * 根据消息角色渲染不同样式：
 * - user: 右对齐，深色气泡
 * - assistant: 左对齐，浅色气泡 + Markdown 渲染
 * - system: 居中灰色小字
 * - 加载态 (assistant 无内容): 三点弹跳动画
 *
 * 使用 react-markdown + remark-gfm 渲染 Markdown，
 * 支持标题、代码块、表格、引用等 GFM 语法。
 */
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message } from '../../types';

interface Props {
  message: Message;
}

/** 格式化时间戳：今日显示 HH:MM，跨日显示 M月D日 HH:MM */
function formatTime(ts?: number): string {
  if (!ts) return '';
  try {
    const date = new Date(ts);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const time = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    return isToday ? time : `${date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })} ${time}`;
  } catch {
    return '';
  }
}

export const MessageBubble: React.FC<Props> = ({ message }) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const isLoading = message.role === 'assistant' && !message.content;

  // 系统消息：居中显示
  if (isSystem) {
    return (
      <div className="msg system" role="status">
        {message.content}
      </div>
    );
  }

  const time = formatTime(message.timestamp);

  return (
    <div
      className={`msg ${isUser ? 'user' : 'assistant'}`}
      role="article"
      aria-label={`${isUser ? '你' : '助手'}的消息`}
    >
      {/* 头像 */}
      <div className={`avatar ${isUser ? 'user' : 'bot'}`} aria-hidden="true">
        {isUser ? '👤' : '🤖'}
      </div>

      <div className="bubble-wrapper">
        {/* 消息内容 */}
        <div className="bubble">
          {isLoading ? (
            /* 加载中：三点弹跳动画 */
            <div className="typing-indicator" aria-label="正在输入...">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
          ) : (
            /* 正常内容：Markdown 渲染 */
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          )}
        </div>

        {/* 时间戳 */}
        {time && (
          <time className="msg-time" dateTime={new Date(message.timestamp).toISOString()}>
            {time}
          </time>
        )}
      </div>
    </div>
  );
};
