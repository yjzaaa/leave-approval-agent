import React from 'react';
import { ThemeToggle } from './ThemeToggle';

export const Header: React.FC = () => (
  <header className="header" role="banner">
    <div className="header-icon-wrapper" aria-hidden="true">🏢</div>
    <div className="header-content">
      <h1>远程办公申请审批</h1>
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
