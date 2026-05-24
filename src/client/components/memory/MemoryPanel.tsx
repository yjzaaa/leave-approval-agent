import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, X, User, Lightbulb, ClipboardList, Link, Brain, FileText, Globe, Package } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Tooltip } from '../ui/Tooltip';
import { cn } from '../../../lib/utils';
import type { MemoryStore, MemoryItem, MemoryType } from '../../../shared/memory';

interface MemoryPanelProps {
  store: MemoryStore;
  pluginId: string;
  onRemove: (type: MemoryType, index: number, pluginId?: string) => void;
  onClearAll: () => void;
  onClose: () => void;
}

const TYPE_CONFIG: Record<MemoryType, { labelKey: string; icon: React.ReactNode; color: string }> = {
  user: { labelKey: 'memory.typeUser', icon: <User className="h-3.5 w-3.5" />, color: '#dbe4ff' },
  feedback: { labelKey: 'memory.typeFeedback', icon: <Lightbulb className="h-3.5 w-3.5" />, color: '#fff9db' },
  project: { labelKey: 'memory.typeProject', icon: <ClipboardList className="h-3.5 w-3.5" />, color: '#fff4e6' },
  reference: { labelKey: 'memory.typeReference', icon: <Link className="h-3.5 w-3.5" />, color: '#ebfbee' },
};

function MemoryCard({ item, index, type, pluginId, onRemove }: {
  item: MemoryItem; index: number; type: MemoryType; pluginId?: string;
  onRemove: (type: MemoryType, index: number, pluginId?: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const config = TYPE_CONFIG[type];
  const timeStr = new Date(item.createdAt).toLocaleDateString(i18n.language, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  return (
    <div className="rounded-lg border border-border p-3" style={{ borderLeftColor: config.color, borderLeftWidth: 3 }}>
      <div className="flex items-center justify-between mb-1">
        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold">
          {config.icon} {t(config.labelKey as any)}
        </span>
        <span className="text-xs text-muted-foreground">{timeStr}</span>
      </div>
      <p className="text-sm text-card-foreground">{item.content}</p>
      <Tooltip text={t('memory.deleteTooltip')}>
        <button
          className="mt-2 text-xs text-muted-foreground hover:text-destructive transition-colors"
          onClick={() => onRemove(type, index, pluginId)}
          aria-label={t('memory.deleteAria')}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </Tooltip>
    </div>
  );
}

/** 记忆面板 — 右侧抽屉式 */
export function MemoryPanel({ store, pluginId, onRemove, onClearAll, onClose }: MemoryPanelProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'shared' | 'plugin'>('shared');
  const pluginMem = store.byPlugin[pluginId] || { project: [], reference: [] };
  const sharedCount = store.shared.user.length + store.shared.feedback.length;
  const pluginCount = pluginMem.project.length + pluginMem.reference.length;
  const totalCount = sharedCount + pluginCount;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <aside className="fixed right-0 top-0 h-full w-80 bg-background border-l border-border shadow-lg z-50 overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-sm font-semibold flex items-center gap-1.5"><Brain className="h-4 w-4" /> {t('memory.title')}</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{t('memory.count', { count: totalCount })}</span>
            <Button variant="outline" size="sm" onClick={onClearAll}>{t('memory.clearAll')}</Button>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors" aria-label={t('memory.close')}>
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        {store.summary && (
          <div className="p-4 border-b border-border">
            <h3 className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> {t('memory.summaryLabel')}</h3>
            <p className="text-xs text-card-foreground">{store.summary}</p>
          </div>
        )}
        <div className="inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground mx-4 mt-4 w-[calc(100%-2rem)]">
          <button
            className={cn(
              'inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-md transition-all',
              activeTab === 'shared'
                ? 'bg-background text-foreground shadow-sm'
                : 'hover:text-foreground'
            )}
            data-state={activeTab === 'shared' ? 'active' : 'inactive'}
            onClick={() => setActiveTab('shared')}
          >
            <Globe className="h-3.5 w-3.5" /> {t('memory.tabShared', { count: sharedCount })}
          </button>
          <button
            className={cn(
              'inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-md transition-all',
              activeTab === 'plugin'
                ? 'bg-background text-foreground shadow-sm'
                : 'hover:text-foreground'
            )}
            data-state={activeTab === 'plugin' ? 'active' : 'inactive'}
            onClick={() => setActiveTab('plugin')}
          >
            <Package className="h-3.5 w-3.5" /> {t('memory.tabPlugin', { count: pluginCount })}
          </button>
        </div>
        <div className="p-4 space-y-3">
          {activeTab === 'shared' ? (
            store.shared.user.length === 0 && store.shared.feedback.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">{t('memory.emptyShared')}</p>
                <p className="text-xs text-muted-foreground/60 mt-1">{t('memory.emptySharedHint')}</p>
              </div>
            ) : (<>
              {store.shared.user.map((item, i) => <MemoryCard key={`u-${i}`} item={item} index={i} type="user" onRemove={onRemove} />)}
              {store.shared.feedback.map((item, i) => <MemoryCard key={`f-${i}`} item={item} index={i} type="feedback" onRemove={onRemove} />)}
            </>)
          ) : (
            pluginMem.project.length === 0 && pluginMem.reference.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">{t('memory.emptyPlugin')}</p>
                <p className="text-xs text-muted-foreground/60 mt-1">{t('memory.emptyPluginHint')}</p>
              </div>
            ) : (<>
              {pluginMem.project.map((item, i) => <MemoryCard key={`p-${i}`} item={item} index={i} type="project" pluginId={pluginId} onRemove={onRemove} />)}
              {pluginMem.reference.map((item, i) => <MemoryCard key={`r-${i}`} item={item} index={i} type="reference" pluginId={pluginId} onRemove={onRemove} />)}
            </>)
          )}
        </div>
        <div className="p-4 border-t border-border">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><Lightbulb className="h-3.5 w-3.5" /> {t('memory.footerText')}</p>
        </div>
      </aside>
    </>
  );
}
