import React, { type ReactNode } from 'react';

interface Props {
  text: string;
  children: ReactNode;
  /** 默认在上方，可选 "bottom" */
  position?: 'top' | 'bottom';
}

/**
 * 统一的气泡提示组件 — 替代浏览器原生 title tooltip
 * 纯 CSS 实现，无 JS 开销
 */
export const Tooltip: React.FC<Props> = ({ text, children, position = 'bottom' }) => {
  const isTop = position === 'top';
  return (
    <span className="relative inline-flex group/tip">
      {children}
      <span
        role="tooltip"
        className={[
          'absolute left-1/2 -translate-x-1/2 z-50',
          'px-2 py-1 text-[11px] leading-tight',
          'rounded-md border border-border bg-popover text-popover-foreground shadow-md',
          'whitespace-nowrap pointer-events-none',
          'opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150',
          isTop ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
        ].join(' ')}
      >
        {text}
      </span>
    </span>
  );
};
