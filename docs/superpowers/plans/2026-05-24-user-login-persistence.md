# 模拟用户登录 + 前端信息持久化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现模拟登录页，按用户 ID 隔离 localStorage 中的记忆、聊天历史和 UI 偏好。

**Architecture:** 前端硬编码用户列表，localStorage key 按 `{prefix}_{userId}` 命名空间隔离。App 层用 `useAuth` 管理登录状态，未登录显示 `LoginScreen`，登录后通过 `key={userId}` 挂载主界面自动重置 Hook。

**Tech Stack:** React 18 + TypeScript, localStorage, 墨韵 CSS Variables

**Spec:** `docs/superpowers/specs/2026-05-24-user-login-persistence-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/client/data/users.ts` | 用户列表 + MockUser 类型 |
| Create | `src/client/hooks/useAuth.ts` | 登录状态管理 (读写 `current_user_id`) |
| Create | `src/client/components/auth/LoginScreen.tsx` | 登录页 UI |
| Modify | `src/client/hooks/useMemory.ts` | localStorage key 参数化 `userId` |
| Modify | `src/client/hooks/useAgent.ts` | 新增聊天历史持久化 (按 userId 隔离) |
| Modify | `src/client/components/layout/ThemeToggle.tsx` | 主题偏好迁移到 `ui_state_{userId}` |
| Modify | `src/client/components/layout/Header.tsx` | 新增用户头像 + 退出下拉 |
| Modify | `src/App.tsx` | 整合 useAuth，条件渲染登录页/主界面 |
| Modify | `src/App.css` | 新增登录页样式 |

---

### Task 1: 用户数据层

**Files:**
- Create: `src/client/data/users.ts`

- [ ] **Step 1: 创建用户数据文件**

```ts
/** 模拟用户数据 */
export interface MockUser {
  id: string;
  name: string;
  role: 'employee' | 'manager' | 'admin';
  department: string;
  avatar: string;
}

export const MOCK_USERS: MockUser[] = [
  { id: 'zhangsan', name: '张三', role: 'employee', department: '技术部', avatar: '👨‍💻' },
  { id: 'lisi',     name: '李四', role: 'manager',  department: '产品部', avatar: '👩‍💼' },
  { id: 'wangwu',   name: '王五', role: 'employee', department: '设计部', avatar: '🎨' },
  { id: 'admin',    name: '管理员', role: 'admin',   department: '管理层', avatar: '🏢' },
];
```

- [ ] **Step 2: Commit**

```bash
git add src/client/data/users.ts
git commit -m "feat: 添加模拟用户数据层"
```

---

### Task 2: useAuth Hook

**Files:**
- Create: `src/client/hooks/useAuth.ts`

- [ ] **Step 1: 创建 useAuth Hook**

```ts
/**
 * 模拟登录状态管理
 *
 * 读写 localStorage `current_user_id`。
 * 未登录时 user 为 null，登录后为 MockUser 对象。
 */
import { useState, useCallback } from 'react';
import { MOCK_USERS, type MockUser } from '../data/users';

const CURRENT_USER_KEY = 'current_user_id';

function loadCurrentUser(): MockUser | null {
  try {
    const id = localStorage.getItem(CURRENT_USER_KEY);
    if (!id) return null;
    return MOCK_USERS.find(u => u.id === id) ?? null;
  } catch {
    return null;
  }
}

export function useAuth() {
  const [user, setUser] = useState<MockUser | null>(loadCurrentUser);

  const login = useCallback((userId: string) => {
    const found = MOCK_USERS.find(u => u.id === userId);
    if (!found) return;
    localStorage.setItem(CURRENT_USER_KEY, userId);
    setUser(found);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(CURRENT_USER_KEY);
    setUser(null);
  }, []);

  return { user, login, logout };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/client/hooks/useAuth.ts
git commit -m "feat: 添加 useAuth 模拟登录 Hook"
```

---

### Task 3: useMemory 参数化 userId

**Files:**
- Modify: `src/client/hooks/useMemory.ts`

- [ ] **Step 1: 修改 useMemory 接受 userId 参数**

将 `MEMORY_STORAGE_KEY` 常量替换为动态 key 函数，`useMemory(userId)` 按 userId 隔离。

在文件顶部，替换 import 和 loadStore/saveStore：

```ts
// 原来的:
// import { MEMORY_STORAGE_KEY, ... } from '../../shared/memory.js';
// 替换为:
import {
  type MemoryStore, type MemoryItem, type MemoryType,
  MEMORY_LIMITS,
  createEmptyStore, getPluginMemories,
} from '../../shared/memory.js';

/** 按用户 ID 生成 localStorage key */
function getStorageKey(userId: string): string {
  return `agent_memory_store_${userId}`;
}

function loadStore(userId: string): MemoryStore {
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return createEmptyStore();
}

function saveStore(userId: string, store: MemoryStore): void {
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(store));
  } catch { /* ignore */ }
}
```

修改 Hook 签名和内部调用：

```ts
// 原来: export function useMemory(): UseMemoryReturn {
// 改为:
export function useMemory(userId: string): UseMemoryReturn {
  const [store, setStore] = useState<MemoryStore>(() => loadStore(userId));

  useEffect(() => {
    saveStore(userId, store);
  }, [store, userId]);
```

其余代码不变。

- [ ] **Step 2: 验证 typecheck 通过**

Run: `npx tsc --noEmit`
Expected: 无错误（App.tsx 中对 useMemory 的调用会在后续 Task 更新）

- [ ] **Step 3: Commit**

```bash
git add src/client/hooks/useMemory.ts
git commit -m "feat: useMemory 支持 userId 参数化 localStorage 隔离"
```

---

### Task 4: useAgent 聊天历史持久化

**Files:**
- Modify: `src/client/hooks/useAgent.ts`
- Modify: `src/client/types.ts` (新增 ChatHistory 类型)

- [ ] **Step 1: 在 types.ts 中新增 ChatHistory 类型**

在 `src/client/types.ts` 末尾添加：

```ts
/** 聊天历史 (按用户持久化) */
export interface ChatHistory {
  messages: Message[];
  activePluginId: string;
  lastActiveAt: number;
}
```

- [ ] **Step 2: 修改 useAgent 支持 userId 和聊天历史持久化**

在 `useAgent.ts` 顶部修改 import，添加 `useEffect`：

```ts
// 原来: import { useCallback, useRef, useState } from 'react';
// 改为:
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatHistory } from '../types';
```

修改 `UseAgentOptions` 接口：

```ts
interface UseAgentOptions {
  pluginId?: string;
  userId?: string;    // ← 新增
  memories?: MemoryItem[];
  summary?: string;
  onSummaryUpdate?: (summary: string, messageCount: number) => void;
  onMemoriesExtracted?: (memories: { user: string[]; feedback: string[]; project: string[]; reference: string[] }) => void;
}
```

在 Hook 函数内部，解构后添加聊天历史逻辑：

```ts
export function useAgent(options?: UseAgentOptions) {
  const pluginId = options?.pluginId;
  const userId = options?.userId;    // ← 新增
  const memories = options?.memories;
  // ... 其他不变

  // ── 聊天历史持久化 ──
  const getChatKey = useCallback(() => {
    return userId ? `chat_history_${userId}` : null;
  }, [userId]);

  // 初始化时加载历史
  // 替换原来的: const [messages, setMessages] = useState<Message[]>([]);
  const [messages, setMessages] = useState<Message[]>(() => {
    if (!userId) return [];
    try {
      const raw = localStorage.getItem(`chat_history_${userId}`);
      if (raw) {
        const history: ChatHistory = JSON.parse(raw);
        return history.messages || [];
      }
    } catch { /* ignore */ }
    return [];
  });

  // 消息变化时 debounce 写入
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!userId || messages.length === 0) return;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      try {
        const history: ChatHistory = {
          messages,
          activePluginId: pluginId || 'leave_approval',
          lastActiveAt: Date.now(),
        };
        localStorage.setItem(`chat_history_${userId}`, JSON.stringify(history));
      } catch { /* quota */ }
    }, 500);
    return () => clearTimeout(saveTimerRef.current);
  }, [messages, userId, pluginId]);
```

注意：`addMessage`、`updateLastAssistant`、`reset` 等函数不需要改动，它们已经通过 `setMessages` 操作状态。

- [ ] **Step 3: 验证 typecheck**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add src/client/hooks/useAgent.ts src/client/types.ts
git commit -m "feat: useAgent 支持聊天历史按 userId 持久化"
```

---

### Task 5: ThemeToggle 迁移到用户隔离

**Files:**
- Modify: `src/client/components/layout/ThemeToggle.tsx`

- [ ] **Step 1: 修改 ThemeToggle 接受 userId，从 ui_state_{userId} 读写**

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add src/client/components/layout/ThemeToggle.tsx
git commit -m "feat: ThemeToggle 迁移到 ui_state_{userId} 用户隔离"
```

---

### Task 6: Header 添加用户菜单

**Files:**
- Modify: `src/client/components/layout/Header.tsx`

- [ ] **Step 1: 修改 Header 接受 user 和 onLogout**

```tsx
import React, { type ReactNode, useState, useEffect, useRef, useCallback } from 'react';
import { ThemeToggle } from './ThemeToggle';
import type { MockUser } from '../../data/users';

interface Props {
  title?: string;
  user?: MockUser | null;
  onLogout?: () => void;
  children?: ReactNode;
}

export const Header: React.FC<Props> = ({ title = '审批助手', user, onLogout, children }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭菜单
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey); };
  }, [menuOpen]);

  return (
    <header className="header" role="banner">
      <div className="header-icon-wrapper" aria-hidden="true">🏢</div>
      <div className="header-content">
        <h1>{title}</h1>
        <div className="header-meta">
          <span className="status-dot" aria-label="服务运行中" />
          <span className="tag">DeepSeek V4 Pro</span>
          <span className="tag">Pi Framework</span>
        </div>
      </div>
      {children && <div className="header-controls">{children}</div>}
      <div style={{ flex: 1 }} />
      <ThemeToggle userId={user?.id} />
      {user && onLogout && (
        <div className="user-menu" ref={menuRef}>
          <button
            className="user-menu-trigger"
            onClick={() => setMenuOpen(v => !v)}
            aria-haspopup="true"
            aria-expanded={menuOpen}
          >
            <span className="user-avatar-sm">{user.avatar}</span>
          </button>
          {menuOpen && (
            <div className="user-menu-dropdown">
              <div className="user-menu-info">
                <span>{user.avatar} {user.name}</span>
                <span className="user-menu-role">{user.department}</span>
              </div>
              <button className="user-menu-item" onClick={() => { setMenuOpen(false); onLogout(); }}>
                退出登录
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add src/client/components/layout/Header.tsx
git commit -m "feat: Header 新增用户头像和退出登录下拉菜单"
```

---

### Task 7: LoginScreen 组件

**Files:**
- Create: `src/client/components/auth/LoginScreen.tsx`

- [ ] **Step 1: 创建登录页组件**

```tsx
import React from 'react';
import { MOCK_USERS, type MockUser } from '../../data/users';

interface Props {
  onLogin: (userId: string) => void;
}

export const LoginScreen: React.FC<Props> = ({ onLogin }) => (
  <div className="login-screen">
    <div className="login-card">
      <h1 className="login-title">审批助手</h1>
      <p className="login-subtitle">选择用户登录</p>
      <div className="login-users">
        {MOCK_USERS.map(user => (
          <button
            key={user.id}
            className="login-user-card"
            onClick={() => onLogin(user.id)}
          >
            <span className="login-user-avatar">{user.avatar}</span>
            <span className="login-user-name">{user.name}</span>
            <span className="login-user-dept">{user.department}</span>
            <span className="login-user-role">{roleLabel(user.role)}</span>
          </button>
        ))}
      </div>
    </div>
  </div>
);

function roleLabel(role: MockUser['role']): string {
  switch (role) {
    case 'employee': return '员工';
    case 'manager': return '主管';
    case 'admin': return '管理员';
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/client/components/auth/LoginScreen.tsx
git commit -m "feat: 添加 LoginScreen 登录页组件"
```

---

### Task 8: 登录页 CSS 样式

**Files:**
- Modify: `src/App.css`

- [ ] **Step 1: 在 App.css 末尾追加登录页样式**

```css
/* ── Login Screen ── */

.login-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: var(--bg-root);
  padding: 24px;
}

.login-card {
  width: 100%;
  max-width: 520px;
  text-align: center;
}

.login-title {
  font-family: var(--font-display);
  font-size: 2rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 4px;
}

.login-subtitle {
  font-size: 0.9rem;
  color: var(--text-tertiary);
  margin: 0 0 32px;
}

.login-users {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.login-user-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 20px 12px;
  background: var(--bg-raised);
  border: 1px solid var(--border-default);
  border-radius: 12px;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s, transform 0.15s;
}

.login-user-card:hover {
  border-color: var(--vermillion-400);
  box-shadow: 0 2px 12px var(--shadow-sm);
  transform: translateY(-2px);
}

.login-user-avatar {
  font-size: 2rem;
  line-height: 1;
  margin-bottom: 4px;
}

.login-user-name {
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--text-primary);
}

.login-user-dept {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.login-user-role {
  font-size: 0.7rem;
  color: var(--text-tertiary);
  background: var(--bg-sunken);
  padding: 1px 8px;
  border-radius: 999px;
  margin-top: 2px;
}

/* ── User Menu (Header) ── */

.user-menu {
  position: relative;
  margin-left: 8px;
}

.user-menu-trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--header-ctrl-bg, var(--bg-sunken));
  border: none;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.2s;
}

.user-menu-trigger:hover {
  background: var(--header-ctrl-hover, var(--bg-hover));
}

.user-avatar-sm {
  line-height: 1;
}

.user-menu-dropdown {
  position: absolute;
  right: 0;
  top: 100%;
  margin-top: 6px;
  background: var(--bg-raised);
  border: 1px solid var(--border-default);
  border-radius: 8px;
  box-shadow: var(--shadow-md);
  min-width: 160px;
  z-index: 100;
  overflow: hidden;
}

.user-menu-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 14px;
  font-size: 0.85rem;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border-default);
}

.user-menu-role {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.user-menu-item {
  display: block;
  width: 100%;
  padding: 8px 14px;
  border: none;
  background: none;
  text-align: left;
  font-size: 0.85rem;
  color: var(--danger);
  cursor: pointer;
}

.user-menu-item:hover {
  background: var(--danger-light);
}

/* ── Login responsive ── */

@media (max-width: 480px) {
  .login-users {
    grid-template-columns: 1fr;
  }
  .login-title {
    font-size: 1.5rem;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/App.css
git commit -m "feat: 添加登录页和用户菜单 CSS 样式"
```

---

### Task 9: App.tsx 整合

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: 整合 useAuth，条件渲染登录页/主界面**

```tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './client/components/layout/Header';
import { StatusBar } from './client/components/approval/StatusBar';
import { ChatContainer } from './client/components/chat/ChatContainer';
import { InputBar } from './client/components/chat/InputBar';
import { ConfirmCard } from './client/components/approval/ConfirmCard';
import { MemoryPanel } from './client/components/memory/MemoryPanel';
import { LoginScreen } from './client/components/auth/LoginScreen';
import { useMemory } from './client/hooks/useMemory';
import { useAgent } from './client/hooks/useAgent';
import { useAuth } from './client/hooks/useAuth';
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

  // 未登录显示登录页
  if (!user) {
    return <LoginScreen onLogin={login} />;
  }

  // 登录后渲染主界面（用 key 确保切换用户时 Hook 重置）
  return <MainApp key={user.id} user={user} onLogout={logout} />;
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
    <>
      <div className={`app${showMemory ? " has-memory-open" : ""}`}>
        <Header title={appTitle} user={user} onLogout={onLogout}>
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

/* ── Custom Dropdown ── */

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
```

- [ ] **Step 2: 验证 typecheck 通过**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: 验证开发服务器启动**

Run: `npm run dev`
Expected: Vite 编译成功，浏览器访问 http://localhost:5173 显示登录页

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: 整合模拟登录，条件渲染登录页/主界面"
```

---

### Task 10: 端到端验证

- [ ] **Step 1: 启动全栈开发环境**

```bash
npm run dev:all
```

- [ ] **Step 2: 功能验证清单**

手动验证以下场景：

1. 打开 http://localhost:5173 → 显示登录页（4 个用户卡片）
2. 点击"张三" → 进入主界面，Header 右侧显示 👨‍💻 头像
3. 发送一条消息 → 刷新页面 → 消息仍在（聊天历史持久化）
4. 切换主题 → 刷新页面 → 主题保持
5. 点击头像 → 下拉菜单 → 点击"退出登录" → 回到登录页
6. 点击"李四" → 空白聊天（数据隔离）
7. 退出 → 再登录"张三" → 之前的消息和主题恢复
8. 在浏览器 DevTools > Application > localStorage 中确认 key 格式为 `{prefix}_{userId}`

- [ ] **Step 3: 最终提交**

```bash
git add -A
git commit -m "feat: 模拟用户登录 + 前端信息持久化完成"
```
