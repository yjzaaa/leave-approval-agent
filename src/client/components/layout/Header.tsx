import React, { type ReactNode } from 'react';
import { ThemeToggle } from './ThemeToggle';

interface Props {
  title?: string;
  children?: ReactNode;
}

export const Header: React.FC<Props> = ({ title = '审批助手', children }) => (
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
    {children && <div className="header-controls">{children}</div>}
    <div style={{ flex: 1 }} />
    <ThemeToggle />
  </header>
);
