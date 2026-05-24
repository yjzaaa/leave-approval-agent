import React, { type ReactNode, useState, useEffect, useRef } from 'react';
import { ThemeToggle } from './ThemeToggle';
import type { MockUser } from '../../data/users';
import { cn } from '../../../lib/utils';
import { MessageSquare, User } from 'lucide-react';

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
    <header className="h-14 border-b border-border bg-background flex-shrink-0 relative z-10" role="banner">
      <div className="flex items-center gap-3 px-4 w-full h-full max-w-3xl mx-auto">
      <div className="flex items-center justify-center w-9 h-9 rounded-full bg-muted flex-shrink-0" aria-hidden="true">
        <MessageSquare className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <h1 className="text-lg font-semibold tracking-tight truncate text-foreground">{title}</h1>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-pulse" aria-label="服务运行中" />
          <span className="font-mono text-[10px] px-1.5 py-[1px] rounded-sm bg-muted text-muted-foreground whitespace-nowrap">DeepSeek V4 Pro</span>
          <span className="font-mono text-[10px] px-1.5 py-[1px] rounded-sm bg-muted text-muted-foreground whitespace-nowrap">Pi Framework</span>
        </div>
      </div>
      {children && <div className="flex items-center gap-2 px-3">{children}</div>}
      <div className="flex-1" />
      <ThemeToggle userId={user?.id} />
      {user && onLogout && (
        <div className="relative" ref={menuRef}>
          <button
            className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-accent transition-colors"
            onClick={() => setMenuOpen(v => !v)}
            aria-haspopup="true"
            aria-expanded={menuOpen}
          >
            <User className="h-4 w-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-border bg-popover text-popover-foreground shadow-md z-50 py-1">
              <div className="px-3 py-2 text-sm">
                <span><User className="h-3.5 w-3.5 inline -mt-0.5" /> {user.name}</span>
                <span className="block text-xs text-muted-foreground mt-0.5">{user.department}</span>
              </div>
              <button
                className="w-full text-left px-3 py-1.5 text-sm text-foreground hover:bg-accent transition-colors"
                onClick={() => { setMenuOpen(false); onLogout(); }}
              >
                退出登录
              </button>
            </div>
          )}
        </div>
      )}
      </div>
    </header>
  );
};
