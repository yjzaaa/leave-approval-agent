import React, { useState } from 'react';
import type { MemoryStore, MemoryItem, MemoryType } from '../../../shared/memory';

interface MemoryPanelProps {
  store: MemoryStore;
  pluginId: string;
  onRemove: (type: MemoryType, index: number, pluginId?: string) => void;
  onClearAll: () => void;
  onClose: () => void;
}

const TYPE_CONFIG: Record<MemoryType, { label: string; icon: string; color: string }> = {
  user: { label: '用户信息', icon: '👤', color: '#dbe4ff' },
  feedback: { label: '反馈偏好', icon: '💡', color: '#fff9db' },
  project: { label: '业务上下文', icon: '📋', color: '#fff4e6' },
  reference: { label: '外部资源', icon: '🔗', color: '#ebfbee' },
};

function MemoryCard({ item, index, type, pluginId, onRemove }: {
  item: MemoryItem; index: number; type: MemoryType; pluginId?: string;
  onRemove: (type: MemoryType, index: number, pluginId?: string) => void;
}) {
  const config = TYPE_CONFIG[type];
  const timeStr = new Date(item.createdAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  return (
    <div className="memory-card" style={{ borderLeftColor: config.color }}>
      <div className="memory-card-header">
        <span className="memory-card-type">{config.icon} {config.label}</span>
        <span className="memory-card-time">{timeStr}</span>
      </div>
      <p className="memory-card-content">{item.content}</p>
      <button className="memory-card-delete" onClick={() => onRemove(type, index, pluginId)} title="删除" aria-label="删除记忆">✕</button>
    </div>
  );
}

export function MemoryPanel({ store, pluginId, onRemove, onClearAll, onClose }: MemoryPanelProps) {
  const [activeTab, setActiveTab] = useState<'shared' | 'plugin'>('shared');
  const pluginMem = store.byPlugin[pluginId] || { project: [], reference: [] };
  const sharedCount = store.shared.user.length + store.shared.feedback.length;
  const pluginCount = pluginMem.project.length + pluginMem.reference.length;
  const totalCount = sharedCount + pluginCount;

  return (
    <>
      <div className="memory-backdrop" onClick={onClose} />
      <aside className="memory-drawer">
        <div className="memory-panel-header">
          <h2>🧠 记忆系统</h2>
          <div className="memory-panel-actions">
            <span className="memory-count">{totalCount} 条</span>
            <button className="memory-btn-clear" onClick={onClearAll}>清空</button>
            <button className="memory-btn-close" onClick={onClose}>✕</button>
          </div>
        </div>
        {store.summary && (
          <div className="memory-summary">
            <h3>📝 对话摘要</h3>
            <p>{store.summary}</p>
          </div>
        )}
        <div className="memory-tabs">
          <button className={`memory-tab ${activeTab === 'shared' ? 'active' : ''}`} onClick={() => setActiveTab('shared')}>🌐 共享 ({sharedCount})</button>
          <button className={`memory-tab ${activeTab === 'plugin' ? 'active' : ''}`} onClick={() => setActiveTab('plugin')}>📦 插件 ({pluginCount})</button>
        </div>
        <div className="memory-list">
          {activeTab === 'shared' ? (
            store.shared.user.length === 0 && store.shared.feedback.length === 0 ? (
              <div className="memory-empty">
                <p>暂无共享记忆</p>
                <p className="memory-empty-hint">对话过程中会自动提取用户信息和偏好</p>
              </div>
            ) : (<>
              {store.shared.user.map((item, i) => <MemoryCard key={`u-${i}`} item={item} index={i} type="user" onRemove={onRemove} />)}
              {store.shared.feedback.map((item, i) => <MemoryCard key={`f-${i}`} item={item} index={i} type="feedback" onRemove={onRemove} />)}
            </>)
          ) : (
            pluginMem.project.length === 0 && pluginMem.reference.length === 0 ? (
              <div className="memory-empty">
                <p>暂无业务记忆</p>
                <p className="memory-empty-hint">使用插件对话后会自动提取</p>
              </div>
            ) : (<>
              {pluginMem.project.map((item, i) => <MemoryCard key={`p-${i}`} item={item} index={i} type="project" pluginId={pluginId} onRemove={onRemove} />)}
              {pluginMem.reference.map((item, i) => <MemoryCard key={`r-${i}`} item={item} index={i} type="reference" pluginId={pluginId} onRemove={onRemove} />)}
            </>)
          )}
        </div>
        <div className="memory-footer">
          <p>💡 共享记忆跨插件 · 业务记忆按插件隔离 · 本地存储</p>
        </div>
      </aside>
    </>
  );
}
