import React from 'react';

export const Header: React.FC = () => (
  <header className="header">
    <span className="header-icon">🏢</span>
    <div>
      <h1>远程办公申请审批</h1>
      <div className="header-meta">
        <span className="dot" />
        <span className="badge">DeepSeek V4 Pro</span>
        <span className="badge">Pi Framework</span>
        <span className="badge">React</span>
      </div>
    </div>
  </header>
);
