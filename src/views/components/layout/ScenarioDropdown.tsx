/**
 * 场景下拉选择器 — 在 Header 中切换业务场景
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '../../../infrastructure/utils/cn';
import { ChevronDown } from 'lucide-react';
import type { ScenarioInfo } from '../../types';

/** 内置场景列表 — /api/scenarios 不可用时的兜底 */
export const FALLBACK_SCENARIOS: ScenarioInfo[] = [
  { id: 'leave_approval', displayName: '远程办公审批', fieldCount: 9 },
  { id: 'expense_approval', displayName: '报销审批', fieldCount: 8 },
  { id: 'sick_leave', displayName: '病假申请', fieldCount: 9 },
];

/** 场景下拉选择器 */
export const ScenarioDropdown: React.FC<{
  scenarios: ScenarioInfo[];
  value: string;
  onChange: (id: string) => void;
}> = ({ scenarios, value, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = scenarios.find(p => p.id === value);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onClick); };
  }, [open, close]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium",
          "hover:bg-accent hover:text-accent-foreground transition-colors",
          open && "bg-accent text-accent-foreground"
        )}
        onClick={() => setOpen(v => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{active?.displayName ?? ''}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <ul
          className="absolute left-0 top-full mt-1 z-50 min-w-[160px] rounded-lg border border-border bg-popover p-1 shadow-md animate-in fade-in slide-in-from-top-2"
          role="listbox"
        >
          {scenarios.map(p => (
            <li
              key={p.id}
              role="option"
              aria-selected={p.id === value}
              className={cn(
                "relative flex cursor-pointer select-none items-center rounded-sm px-3 py-2 text-sm outline-none",
                "hover:bg-accent hover:text-accent-foreground transition-colors",
                p.id === value && "bg-accent text-accent-foreground font-medium"
              )}
              onClick={() => { onChange(p.id); close(); }}
            >
              {p.displayName}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
