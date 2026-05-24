import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
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
import type { ScenarioInfo } from './client/types';

const FALLBACK_SCENARIOS: ScenarioInfo[] = [
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
  const { t } = useTranslation();
  const [scenarios, setScenarios] = useState<ScenarioInfo[]>(FALLBACK_SCENARIOS);
  const [activeScenarioId, setActiveScenarioId] = useState('leave_approval');
  const [appTitle, setAppTitle] = useState('远程办公申请审批');
  const [suggestions, setSuggestions] = useState<string[]>(DEFAULT_SUGGESTIONS.leave_approval);
  const [showMemory, setShowMemory] = useState(false);
  const [legalModal, setLegalModal] = useState<'privacy' | 'legal' | null>(null);

  const { store: memoryStore, getMemories: getMemoriesForScenario, addSharedMemory, addScenarioMemory, removeMemory, setSummary, clearAll } = useMemory(user.id);
  const scenarioMemories = getMemoriesForScenario(activeScenarioId);

  const { messages, phase, phaseText, confirmRequest, isStreaming, error, sendMessage, confirm, reset } = useAgent({
    scenarioId: activeScenarioId,
    userId: user.id,
    memories: scenarioMemories,
    summary: memoryStore.summary,
  });

  useEffect(() => {
    fetch('/api/scenarios').then(r => r.json()).then(data => {
      if (data.scenarios?.length > 0) {
        setScenarios(data.scenarios);
        const ap = data.scenarios.find((p: ScenarioInfo & { suggestions?: string[] }) => p.id === activeScenarioId);
        if (ap?.suggestions) setSuggestions(ap.suggestions);
      }
    }).catch(() => { console.log('[App] /api/scenarios 不可用，使用内置场景列表'); });
  }, []);

  const switchScenario = (scenarioId: string) => {
    const p = scenarios.find(pl => pl.id === scenarioId);
    if (p && scenarioId !== activeScenarioId) {
      setActiveScenarioId(scenarioId);
      setAppTitle(p.displayName);
      setSuggestions(DEFAULT_SUGGESTIONS[scenarioId] || []);
      fetch('/api/scenarios').then(r => r.json()).then(data => {
        const sp = data.scenarios?.find((pl: ScenarioInfo & { suggestions?: string[] }) => pl.id === scenarioId);
        if (sp?.suggestions) setSuggestions(sp.suggestions);
      }).catch(() => {});
      reset();
    }
  };

  useEffect(() => {
    const active = scenarios.find(p => p.id === activeScenarioId);
    if (active) setAppTitle(active.displayName);
  }, [scenarios]);

  return (
    <div className="flex h-dvh flex-col bg-background">
      <Header title={appTitle} user={user} onLogout={onLogout}>
        <ScenarioDropdown scenarios={scenarios} value={activeScenarioId} onChange={switchScenario} />
        <Tooltip text={t('memory.title')} position="bottom">
          <button
            className={cn(
              "inline-flex items-center justify-center rounded-full h-9 w-9 text-sm hover:bg-accent transition-colors",
              showMemory && "bg-accent text-accent-foreground"
            )}
            onClick={() => setShowMemory(v => !v)}
            aria-label={t('memory.title')}
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
        >{t('app.footer.privacy')}</button>
        <span className="text-xs text-muted-foreground/40">·</span>
        <button
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setLegalModal('legal')}
        >{t('app.footer.legal')}</button>
        <span className="text-xs text-muted-foreground/40">·</span>
        <span className="text-xs text-muted-foreground/60">{t('app.footer.copyright', { year: 2026, version: '2.1' })}</span>
      </footer>
      {confirmRequest && (<ConfirmCard confirmRequest={confirmRequest} onConfirm={confirm} />)}
      {showMemory && (
        <MemoryPanel store={memoryStore} scenarioId={activeScenarioId} onRemove={removeMemory} onClearAll={clearAll} onClose={() => setShowMemory(false)} />
      )}
      <PrivacyPolicy open={legalModal === 'privacy'} onClose={() => setLegalModal(null)} />
      <LegalNotice open={legalModal === 'legal'} onClose={() => setLegalModal(null)} />
    </div>
  );
};

/* ── Scenario Dropdown ── */

const ScenarioDropdown: React.FC<{
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
