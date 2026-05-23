import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './client/components/layout/Header';
import { StatusBar } from './client/components/approval/StatusBar';
import { ChatContainer } from './client/components/chat/ChatContainer';
import { InputBar } from './client/components/chat/InputBar';
import { ConfirmCard } from './client/components/approval/ConfirmCard';
import { MemoryPanel } from './client/components/memory/MemoryPanel';
import { useMemory } from './client/hooks/useMemory';
import { useAgent } from './client/hooks/useAgent';
import type { PluginInfo } from './client/types';

const FALLBACK_PLUGINS: PluginInfo[] = [
  { id: 'leave_approval', displayName: '远程办公审批', fieldCount: 9 },
  { id: 'expense_approval', displayName: '报销审批', fieldCount: 8 },
  { id: 'sick_leave', displayName: '病假申请', fieldCount: 9 },
];

const DEFAULT_SUGGESTIONS: Record<string, string[]> = {
  leave_approval: ['我需要申请远程办公', '家人住院需要照顾', '身体不适在家办公'],
  expense_approval: ['我需要报销差旅费', '办公用品报销申请', '客户招待费用报销'],
  sick_leave: ['我发烧了需要请病假', '身体不适请 3 天病假', '急性肠胃炎需要休息'],
};

export default function App() {
  const [plugins, setPlugins] = useState<PluginInfo[]>(FALLBACK_PLUGINS);
  const [activePluginId, setActivePluginId] = useState('leave_approval');
  const [appTitle, setAppTitle] = useState('远程办公申请审批');
  const [suggestions, setSuggestions] = useState<string[]>(DEFAULT_SUGGESTIONS.leave_approval);
  const { messages, phase, phaseText, confirmRequest, isStreaming, error, sendMessage, confirm, reset } = useAgent({ pluginId: activePluginId });
  const { store: memoryStore, getMemories: getMemoriesForPlugin, addSharedMemory, addPluginMemory, removeMemory, setSummary, clearAll } = useMemory();
  const [showMemory, setShowMemory] = useState(false);
  const pluginMemories = getMemoriesForPlugin(activePluginId);

  useEffect(() => {
    fetch('/api/plugins').then(r => r.json()).then(data => {
      if (data.plugins?.length > 0) {
        setPlugins(data.plugins);
        const ap = data.plugins.find((p: PluginInfo & { suggestions?: string[] }) => p.id === activePluginId);
        if (ap?.suggestions) setSuggestions(ap.suggestions);
      }
    }).catch(() => { console.log('[App] /api/plugins 不可用，使用内置插件列表'); });
  }, []);

  const switchPlugin = (pluginId: string) => {
    const p = plugins.find(pl => pl.id === pluginId);
    if (p && pluginId !== activePluginId) {
      setActivePluginId(pluginId);
      setAppTitle(p.displayName);
      setSuggestions(DEFAULT_SUGGESTIONS[pluginId] || []);
      fetch('/api/plugins').then(r => r.json()).then(data => {
        const sp = data.plugins?.find((pl: PluginInfo & { suggestions?: string[] }) => pl.id === pluginId);
        if (sp?.suggestions) setSuggestions(sp.suggestions);
      }).catch(() => {});
      reset();
    }
  };

  useEffect(() => {
    const active = plugins.find(p => p.id === activePluginId);
    if (active) setAppTitle(active.displayName);
  }, [plugins]);

  return (
    <>
      <div className={`app${showMemory ? " has-memory-open" : ""}`}>
        <Header title={appTitle}>
          <div className="plugin-selector">
            <label className="plugin-selector-label">📋</label>
            <PluginDropdown
              plugins={plugins}
              value={activePluginId}
              onChange={switchPlugin}
            />
          </div>
          <button className={`memory-toggle-btn${showMemory ? " active" : ""}`} onClick={() => setShowMemory(v => !v)} title="查看记忆">🧠</button>
        </Header>
        <main className="main-content">
          <StatusBar phase={phase} text={phaseText} />
          <ChatContainer messages={messages} suggestions={suggestions} />
          <InputBar onSend={sendMessage} disabled={isStreaming} />
        </main>
        {confirmRequest && (<ConfirmCard confirmRequest={confirmRequest} onConfirm={confirm} />)}
      </div>
      {showMemory && (
        <MemoryPanel store={memoryStore} pluginId={activePluginId} onRemove={removeMemory} onClearAll={clearAll} onClose={() => setShowMemory(false)} />
      )}
    </>
  );
};

/* ── Custom Dropdown (replaces native <select> for theme consistency) ── */

const PluginDropdown: React.FC<{
  plugins: PluginInfo[];
  value: string;
  onChange: (id: string) => void;
}> = ({ plugins, value, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = plugins.find(p => p.id === value);

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
    <div className="plugin-dropdown" ref={ref}>
      <button
        type="button"
        className={`plugin-dropdown-trigger${open ? ' open' : ''}`}
        onClick={() => setOpen(v => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="plugin-dropdown-text">{active?.displayName ?? ''}</span>
        <svg className="plugin-dropdown-arrow" width="12" height="12" viewBox="0 0 12 12">
          <path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <ul className="plugin-dropdown-menu" role="listbox">
          {plugins.map(p => (
            <li
              key={p.id}
              role="option"
              aria-selected={p.id === value}
              className={`plugin-dropdown-item${p.id === value ? ' active' : ''}`}
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
