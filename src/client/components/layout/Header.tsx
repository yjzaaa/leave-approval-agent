import React, { type ReactNode, useState, useEffect, useRef } from 'react';
import { ThemeToggle } from './ThemeToggle';
import type { MockUser } from '../../data/users';

interface Props {
  title?: string;
  user?: MockUser | null;
  onLogout?: () => void;
  children?: ReactNode;
}

export const Header: React.FC<Props> = ({ title = '审批助手', user, onLogout, children }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭菜单
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey); };
  }, [menuOpen]);

  return (
    <header className="header" role="banner">
      <div className="header-icon-wrapper" aria-hidden="true">🏢</div>
      <div className="header-content">
        <h1>{title}</h1>
        <div className="header-meta">
          <span className="status-dot" aria-label="服务运行中" />
          <span className="tag">DeepSeek V4 Pro</span>
          <span className="tag">Pi Framework</span>
        </div>
      </div>
      {children && <div className="header-controls">{children}</div>}
      <div style={{ flex: 1 }} />
      <ThemeToggle userId={user?.id} />
      {user && onLogout && (
        <div className="user-menu" ref={menuRef}>
          <button
            className="user-menu-trigger"
            onClick={() => setMenuOpen(v => !v)}
            aria-haspopup="true"
            aria-expanded={menuOpen}
          >
            <span className="user-avatar-sm">{user.avatar}</span>
          </button>
          {menuOpen && (
            <div className="user-menu-dropdown">
              <div className="user-menu-info">
                <span>{user.avatar} {user.name}</span>
                <span className="user-menu-role">{user.department}</span>
              </div>
              <button className="user-menu-item" onClick={() => { setMenuOpen(false); onLogout(); }}>
                退出登录
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
};
