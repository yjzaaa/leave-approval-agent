import React, { useEffect, useState, useCallback } from 'react';

type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'leave-approval-theme';

function getStoredTheme(): Theme {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {}
  return 'system';
}

function applyTheme(t: Theme) {
  const root = document.documentElement;
  root.removeAttribute('data-theme');
  root.classList.remove('dark');
  if (t === 'light') root.setAttribute('data-theme', 'light');
  else if (t === 'dark') root.classList.add('dark');
}

export const ThemeToggle: React.FC = () => {
  const [theme, setTheme] = useState<Theme>(getStoredTheme);

  useEffect(() => { applyTheme(theme); }, [theme]);

  const cycle = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'system' ? 'dark' : prev === 'dark' ? 'light' : 'system';
      try { localStorage.setItem(STORAGE_KEY, next); } catch {}
      return next;
    });
  }, []);

  const icon = theme === 'dark' ? '☀️' : theme === 'light' ? '🌙' : '💻';
  const label = theme === 'dark' ? '暗色' : theme === 'light' ? '亮色' : '跟随系统';

  return (
    <button
      className="theme-toggle"
      onClick={cycle}
      aria-label={`主题切换，当前：${label}`}
      title={`主题：${label}（点击切换）`}
    >
      {icon}
    </button>
  );
};
