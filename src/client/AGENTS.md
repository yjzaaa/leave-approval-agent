# 前端 UI 壳层

> ⬆️ [返回项目根目录](../../AGENTS.md) · 📋 相关: [shared/](../shared/AGENTS.md) · [server/](../server/AGENTS.md)

## 职责

React 前端，通过 SSE 与后端通信。不关心具体业务逻辑。

**核心约束：前端不知道任何具体业务插件的存在。**

## 架构

```
client/
├── types.ts                         # 泛化类型
├── hooks/
│   ├── useAgent.ts                  # 聊天状态机 Hook
│   └── useMemory.ts                 # 记忆系统 Hook (localStorage)
└── components/
    ├── chat/
    │   ├── ChatContainer.tsx        # 消息列表 + 自动滚动
    │   ├── MessageBubble.tsx        # 消息气泡 (react-markdown)
    │   └── InputBar.tsx             # 输入框 + 发送
    ├── approval/
    │   ├── ConfirmCard.tsx          # HITL 确认弹窗
    │   └── StatusBar.tsx            # 流水线状态栏
    ├── layout/
    │   ├── Header.tsx               # 顶部导航 + 插件选择
    │   └── ThemeToggle.tsx          # 主题切换 (system/dark/light)
    └── memory/
        └── MemoryPanel.tsx          # 记忆面板 (抽屉式)
```

## 前端状态机图

```mermaid
stateDiagram-v2
    [*] --> idle : 页面加载
    idle --> processing : 发送消息

    state processing {
        [*] --> streaming
        streaming : SSE text → 流式渲染
        streaming : InputBar 禁用
    }

    processing --> awaiting_confirm : SSE confirm_required
    processing --> done : SSE done
    processing --> error : 网络错误

    state awaiting_confirm {
        [*] --> show_card
        show_card : ConfirmCard 弹出
    }

    awaiting_confirm --> processing : 确认/拒绝 → POST confirm
    done --> idle
    error --> idle
```

## SSE 事件处理流程

```mermaid
sequenceDiagram
    participant SSE as EventSource
    participant Hook as useAgent.ts
    participant UI as 组件

    SSE->>Hook: event: text {content}
    Hook->>UI: appendMessage()
    UI->>UI: MessageBubble 渲染

    SSE->>Hook: event: confirm_required
    Hook->>UI: setConfirmRequest()
    UI->>UI: ConfirmCard 弹出

    SSE->>Hook: event: confirm_resolved
    Hook->>UI: 关闭 ConfirmCard

    SSE->>Hook: event: done {}
    Hook->>UI: setPhase('done')
```

## 组件层级

```mermaid
graph TD
    App --> Header
    Header --> ThemeToggle
    Header --> PluginSelector
    App --> StatusBar
    App --> ChatContainer
    ChatContainer --> MessageBubble1["MessageBubble × N"]
    MessageBubble1 --> Markdown["react-markdown + remark-gfm"]
    App --> ConfirmCard
    App --> InputBar
    App --> MemoryPanel["MemoryPanel (抽屉)"]

    style App fill:#dbe4ff,stroke:#495057,color:#1a1a1a
    style ChatContainer fill:#dbe4ff,stroke:#495057,color:#1a1a1a
    style ConfirmCard fill:#ffe3e3,stroke:#495057,color:#1a1a1a
    style MemoryPanel fill:#e7f5ff,stroke:#495057,color:#1a1a1a
```

## 设计系统 — 墨韵 (Ink Resonance)

| 概念 | 值 | 说明 |
|------|-----|------|
| 色调 | Warm paper + ink-dark + vermillion | 宣纸 + 墨色 + 朱砂 |
| 亮色背景 | `#F5F0E8` | 暖纸白 |
| 暗色背景 | `#121210` | 浓墨色 |
| 强调色 | `#D4463A` | 朱砂红 |
| 正文色 | `#1C1814` / `#E8E2D6` | 墨色/淡墨 |
| 标题字体 | Crimson Pro + Noto Serif SC | 衬线体 |
| 等宽字体 | IBM Plex Mono | 代码块 |
| 正文字体 | Noto Sans SC | 无衬线 |
| 主题 | system (auto) / dark / light | 三态切换 |
| 布局 | 全宽 + 内容居中 `max(24px, (100%-820px)/2)` | 自适应 |
| 断点 | 820px / 640px | 响应式 |

### 主题系统

```mermaid
graph LR
    Toggle["ThemeToggle<br/>localStorage: leave-approval-theme"]
    Toggle --> |"system"| Media["@media prefers-color-scheme"]
    Toggle --> |"dark"| DarkClass[".dark 类"]
    Toggle --> |"light"| LightAttr["[data-theme='light']"]

    Media --> CSS["CSS Variables 切换"]
    DarkClass --> CSS
    LightAttr --> CSS
```

### 字体加载策略

Google Fonts 通过 `media="print" onload="this.media='all'"` 异步加载，避免阻塞渲染。`<head>` 内联关键 CSS 提供背景色 fallback。

## 记忆系统 (前端)

| 概念 | 实现 |
|------|------|
| 持久化 | `localStorage` (`agent_memory_store`) |
| Hook | `useMemory.ts` — CRUD + 容量管理 (FIFO 淘汰) |
| UI | `MemoryPanel.tsx` — 桌面右侧抽屉 / 平板覆盖层 / 手机底部抽屉 |
| 隔离 | user/feedback 跨插件共享，project/reference 按插件隔离 |

## 约束

- ❌ 不 import plugins/ agent/
- ❌ 不硬编码具体 tool 名称
- ✅ 业务信息全通过 SSE 事件获取
- ✅ 记忆通过 `useMemory` Hook 管理

---

> ⬆️ [返回项目根目录](../../AGENTS.md) · 📋 相关: [shared/](../shared/AGENTS.md) · [server/](../server/AGENTS.md)
