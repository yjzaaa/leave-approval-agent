import React, { useEffect, useState, useCallback } from 'react';

type Theme = 'light' | 'dark' | 'system';

/** 从 ui_state_{userId} 中读写主题偏好 */
function getStoredTheme(userId?: string): Theme {
  try {
    if (userId) {
      const raw = localStorage.getItem(`ui_state_${userId}`);
      if (raw) {
        const state = JSON.parse(raw);
        const t = state.theme;
        if (t === 'light' || t === 'dark' || t === 'system') return t;
      }
    }
    // 回退到旧 key (兼容未登录时)
    const v = localStorage.getItem('leave-approval-theme');
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {}
  return 'system';
}

function saveTheme(userId: string, theme: Theme) {
  try {
    const key = `ui_state_${userId}`;
    let state: Record<string, unknown> = {};
    try { state = JSON.parse(localStorage.getItem(key) || '{}'); } catch {}
    state.theme = theme;
    localStorage.setItem(key, JSON.stringify(state));
  } catch {}
}

function applyTheme(t: Theme) {
  const root = document.documentElement;
  root.removeAttribute('data-theme');
  root.classList.remove('dark');
  if (t === 'light') root.setAttribute('data-theme', 'light');
  else if (t === 'dark') root.classList.add('dark');
}

export const ThemeToggle: React.FC<{ userId?: string }> = ({ userId }) => {
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme(userId));

  useEffect(() => { applyTheme(theme); }, [theme]);

  // userId 变化时重新加载主题
  useEffect(() => {
    if (userId) setTheme(getStoredTheme(userId));
  }, [userId]);

  const cycle = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'system' ? 'dark' : prev === 'dark' ? 'light' : 'system';
      if (userId) saveTheme(userId, next);
      else { try { localStorage.setItem('leave-approval-theme', next); } catch {} }
      return next;
    });
  }, [userId]);

  const icon = theme === 'dark' ? '☀️' : theme === 'light' ? '🌙' : '💻';
  const label = theme === 'dark' ? '暗色' : theme === 'light' ? '亮色' : '跟随系统';
  return (
    <button className="theme-toggle" onClick={cycle} aria-label={`主题切换，当前：${label}`} title={`主题：${label}（点击切换）`}>
      {icon}
    </button>
  );
};
