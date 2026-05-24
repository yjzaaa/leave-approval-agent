import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './client/components/layout/Header';
import { StatusBar } from './client/components/approval/StatusBar';
import { ChatContainer } from './client/components/chat/ChatContainer';
import { InputBar } from './client/components/chat/InputBar';
import { ConfirmCard } from './client/components/approval/ConfirmCard';
import { MemoryPanel } from './client/components/memory/MemoryPanel';
import { LoginScreen } from './client/components/auth/LoginScreen';
import { PrivacyPolicy } from './client/components/legal/PrivacyPolicy';
import { LegalNotice } from './client/components/legal/LegalNotice';
import { useMemory } from './client/hooks/useMemory';
import { useAgent } from './client/hooks/useAgent';
import { useAuth } from './client/hooks/useAuth';
import { ThemeProvider } from './components/ThemeProvider';
import { cn } from './lib/utils';
import { ChevronDown, Brain } from 'lucide-react';
import { Tooltip } from './client/components/ui/Tooltip';
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
  const { user, login, logout } = useAuth();

  if (!user) {
    return <LoginScreen onLogin={login} />;
  }

  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <MainApp key={user.id} user={user} onLogout={logout} />
    </ThemeProvider>
  );
}

/** 登录后的主界面 */
const MainApp: React.FC<{
  user: NonNullable<ReturnType<typeof useAuth>['user']>;
  onLogout: () => void;
}> = ({ user, onLogout }) => {
  const [plugins, setPlugins] = useState<PluginInfo[]>(FALLBACK_PLUGINS);
  const [activePluginId, setActivePluginId] = useState('leave_approval');
  const [appTitle, setAppTitle] = useState('远程办公申请审批');
  const [suggestions, setSuggestions] = useState<string[]>(DEFAULT_SUGGESTIONS.leave_approval);
  const [showMemory, setShowMemory] = useState(false);
  const [legalModal, setLegalModal] = useState<'privacy' | 'legal' | null>(null);

  const { store: memoryStore, getMemories: getMemoriesForPlugin, addSharedMemory, addPluginMemory, removeMemory, setSummary, clearAll } = useMemory(user.id);
  const pluginMemories = getMemoriesForPlugin(activePluginId);

  const { messages, phase, phaseText, confirmRequest, isStreaming, error, sendMessage, confirm, reset } = useAgent({
    pluginId: activePluginId,
    userId: user.id,
    memories: pluginMemories,
    summary: memoryStore.summary,
  });

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
    <div className="flex h-dvh flex-col bg-background">
      <Header title={appTitle} user={user} onLogout={onLogout}>
        <PluginDropdown plugins={plugins} value={activePluginId} onChange={switchPlugin} />
        <Tooltip text="查看记忆" position="bottom">
          <button
            className={cn(
              "inline-flex items-center justify-center rounded-full h-9 w-9 text-sm hover:bg-accent transition-colors",
              showMemory && "bg-accent text-accent-foreground"
            )}
            onClick={() => setShowMemory(v => !v)}
            aria-label="查看记忆"
          >
            <Brain className="h-4 w-4" />
          </button>
        </Tooltip>
      </Header>
      <main className="flex flex-1 flex-col min-h-0">
        <StatusBar phase={phase} text={phaseText} />
        <ChatContainer messages={messages} suggestions={suggestions} />
        <InputBar onSend={sendMessage} disabled={isStreaming} />
      </main>
      {/* Footer — 合规链接 */}
      <footer className="flex items-center justify-center gap-4 h-8 border-t border-border bg-background flex-shrink-0 px-4">
        <button
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setLegalModal('privacy')}
        >隐私政策</button>
        <span className="text-xs text-muted-foreground/40">·</span>
        <button
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setLegalModal('legal')}
        >法律声明</button>
        <span className="text-xs text-muted-foreground/40">·</span>
        <span className="text-xs text-muted-foreground/60">© 2026 审批助手 v2.1 — Enterprise Edition</span>
      </footer>
      {confirmRequest && (<ConfirmCard confirmRequest={confirmRequest} onConfirm={confirm} />)}
      {showMemory && (
        <MemoryPanel store={memoryStore} pluginId={activePluginId} onRemove={removeMemory} onClearAll={clearAll} onClose={() => setShowMemory(false)} />
      )}
      <PrivacyPolicy open={legalModal === 'privacy'} onClose={() => setLegalModal(null)} />
      <LegalNotice open={legalModal === 'legal'} onClose={() => setLegalModal(null)} />
    </div>
  );
};

/* ── Plugin Dropdown ── */

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
          {plugins.map(p => (
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
