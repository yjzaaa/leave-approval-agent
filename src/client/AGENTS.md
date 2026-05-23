# 前端 UI 壳层

> ⬆️ [返回项目根目录](../../AGENTS.md) · 📋 相关: [shared/](../shared/AGENTS.md) · [server/](../server/AGENTS.md)

## 职责

React 前端，通过 SSE 与后端通信。不关心具体业务逻辑。

**核心约束：前端不知道任何具体业务插件的存在。**

## 架构

```
client/
├── types.ts                    # 泛化类型
├── hooks/useAgent.ts           # 聊天状态机 Hook
└── components/
    ├── chat/   (Container, Bubble, Input)
    ├── approval/ (ConfirmCard, StatusBar)
    └── layout/ (Header, ThemeToggle)
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
    MessageBubble1 --> Markdown["react-markdown"]
    App --> ConfirmCard
    App --> InputBar

    style App fill:#dbe4ff,stroke:#495057,color:#1a1a1a
    style ChatContainer fill:#dbe4ff,stroke:#495057,color:#1a1a1a
    style ConfirmCard fill:#ffe3e3,stroke:#495057,color:#1a1a1a
```

## 设计系统

- Slate/Warm Gray 极简，CSS Variables token
- 禁止蓝紫渐变
- 响应式 `640px` 断点
- dark/light/system 主题
- Inter + Noto Sans SC

## 约束

- ❌ 不 import plugins/ agent/
- ❌ 不硬编码具体 tool 名称
- ✅ 业务信息全通过 SSE 事件获取

---

> ⬆️ [返回项目根目录](../../AGENTS.md) · 📋 相关: [shared/](../shared/AGENTS.md) · [server/](../server/AGENTS.md)