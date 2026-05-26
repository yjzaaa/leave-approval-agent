/**
 * 登录后的主界面 — 场景切换、聊天、确认、记忆面板、合规链接
 */
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Header } from './Header';
import { StatusBar } from '../approval/StatusBar';
import { ChatContainer } from '../chat/ChatContainer';
import { InputBar } from '../chat/InputBar';
import { ConfirmCard } from '../approval/ConfirmCard';
import { MemoryPanel } from '../memory/MemoryPanel';
import { PrivacyPolicy } from '../legal/PrivacyPolicy';
import { LegalNotice } from '../legal/LegalNotice';
import { ScenarioDropdown, FALLBACK_SCENARIOS } from './ScenarioDropdown';
import { useMemory } from '../../hooks/useMemory';
import { useAgent } from '../../../controllers/hooks/useAgent';
import { useAuth } from '../../hooks/useAuth';
import { cn } from '../../../infrastructure/utils/cn';
import { Brain } from 'lucide-react';
import { Tooltip } from '../ui/Tooltip';
import type { ScenarioInfo } from '../../types';

/** 各场景默认快捷建议 */
const DEFAULT_SUGGESTIONS: Record<string, string[]> = {
  leave_approval: ['我需要申请远程办公', '家人住院需要照顾', '身体不适在家办公'],
  expense_approval: ['我需要报销差旅费', '办公用品报销申请', '客户招待费用报销'],
  sick_leave: ['我发烧了需要请病假', '身体不适请 3 天病假', '急性肠胃炎需要休息'],
};

/** 登录后的主界面 */
export const MainApp: React.FC<{
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

  const { store: memoryStore, getMemories: getMemoriesForScenario, removeMemory, clearAll } = useMemory(user.id);
  const scenarioMemories = getMemoriesForScenario(activeScenarioId);

  const { messages, phase, phaseText, confirmRequest, isStreaming, error, sendMessage, confirm, reset } = useAgent({
    scenarioId: activeScenarioId,
    userId: user.id,
    memories: scenarioMemories,
    summary: memoryStore.summary,
  });

  // 初始化：尝试从后端加载场景列表
  useEffect(() => {
    fetch('/api/scenarios').then(r => r.json()).then(data => {
      if (data.scenarios?.length > 0) {
        setScenarios(data.scenarios);
        const ap = data.scenarios.find((p: ScenarioInfo & { suggestions?: string[] }) => p.id === activeScenarioId);
        if (ap?.suggestions) setSuggestions(ap.suggestions);
      }
    }).catch(() => { console.log('[App] /api/scenarios 不可用，使用内置场景列表'); });
  }, []);

  /** 切换场景 */
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

  // 场景列表变化时同步标题
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
