/**
 * 顶部导航栏 v3.0
 *
 * 标题由外部注入（支持多插件切换时动态显示插件名）。
 * 展示技术标签、在线状态和主题切换按钮。
 */
import React from 'react';
import { ThemeToggle } from './ThemeToggle';

interface Props {
  title?: string;
}

export const Header: React.FC<Props> = ({ title = '审批助手' }) => (
  <header className="header" role="banner">
    <div className="header-icon-wrapper" aria-hidden="true">🏢</div>
    <div className="header-content">
      <h1>{title}</h1>
      <div className="header-meta">
        <span className="status-dot" aria-label="服务运行中" />
        <span className="tag">DeepSeek V4 Pro</span>
        <span className="tag">Pi Framework</span>
        <span className="tag">React 18</span>
      </div>
    </div>
    <div style={{ flex: 1 }} />
    <ThemeToggle />
  </header>
);
