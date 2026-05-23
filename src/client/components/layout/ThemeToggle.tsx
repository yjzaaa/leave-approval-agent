/**
 * 主题切换按钮
 *
 * 三段式循环切换：跟随系统 → 暗色 → 亮色 → 跟随系统
 * 状态持久化到 localStorage，手动选择覆盖系统偏好
 *
 * 实现原理：
 * - dark 模式：给 <html> 添加 .dark class
 * - light 模式：设置 data-theme="light" 属性
 * - system 模式：移除以上两者，由 CSS @media (prefers-color-scheme) 控制
 */
import React, { useEffect, useState, useCallback } from 'react';

type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'leave-approval-theme';

/** 从 localStorage 读取已保存的主题偏好 */
function getStoredTheme(): Theme {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {}
  return 'system';
}

/** 将主题应用到 DOM（操作 <html> 的 class/属性） */
function applyTheme(t: Theme) {
  const root = document.documentElement;
  root.removeAttribute('data-theme');
  root.classList.remove('dark');
  if (t === 'light') root.setAttribute('data-theme', 'light');
  else if (t === 'dark') root.classList.add('dark');
}

export const ThemeToggle: React.FC = () => {
  const [theme, setTheme] = useState<Theme>(getStoredTheme);

  // 主题变化时同步到 DOM
  useEffect(() => { applyTheme(theme); }, [theme]);

  // 三段式循环切换
  const cycle = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'system' ? 'dark' : prev === 'dark' ? 'light' : 'system';
      try { localStorage.setItem(STORAGE_KEY, next); } catch {}
      return next;
    });
  }, []);

  // 图标和提示文字
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
