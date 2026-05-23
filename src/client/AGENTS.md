# 前端 UI 壳层

> ⬆️ [返回项目根目录](../../AGENTS.md) · 📋 相关: [shared/](../shared/AGENTS.md) · [server/](../server/AGENTS.md) · 📊 [前端状态机图](../../docs/diagrams/frontend-state-machine.mmd)

## 职责

React 前端，负责聊天界面、审批确认弹窗、主题切换。通过 SSE 与后端通信，不关心具体业务逻辑。

**核心约束：前端不知道任何具体业务插件的存在，只通过泛化类型通信。**

## 架构

```
client/
├── AGENTS.md                          # 本文档
├── types.ts                           # 泛化类型
├── hooks/
│   └── useAgent.ts                    # 聊天状态机 Hook
└── components/
    ├── chat/
    │   ├── ChatContainer.tsx          # 消息列表 + 自动滚动
    │   ├── MessageBubble.tsx          # 消息气泡 (Markdown)
    │   └── InputBar.tsx               # 输入框
    ├── approval/
    │   ├── ConfirmCard.tsx            # 通用确认弹窗
    │   └── StatusBar.tsx              # 流水线指示器
    └── layout/
        ├── Header.tsx                 # 顶栏 + 插件选择器
        └── ThemeToggle.tsx            # 三态主题切换
```

## 前端状态机

```
                  用户发送消息
                       │
                       ▼
                ┌──────────────┐
                │  processing  │  Agent 工作中
                └──────┬───────┘
                       │
            ┌──────────┴──────────┐
     confirm_required         done / error
            │                       │
            ▼                       ▼
  ┌──────────────────┐    ┌──────────────┐
  │ awaiting_confirm │    │     done     │
  │ 弹出确认卡片     │    └──────────────┘
  └────────┬─────────┘
   确认/拒绝 │
            ▼
  ┌──────────────────┐
  │   processing     │  继续等待
  └──────────────────┘
```

## SSE 事件处理流程

```
EventSource              useAgent.ts              UI 组件
    │                        │                       │
    │ SSE: text              │ appendMessage()       │ MessageBubble
    │───────────────────────→│──────────────────────→│
    │                        │                       │
    │ SSE: confirm_required  │ setConfirmRequest()   │ ConfirmCard 弹出
    │───────────────────────→│──────────────────────→│
    │                        │                       │
    │ SSE: confirm_resolved  │ setConfirmReq(null)   │ ConfirmCard 关闭
    │───────────────────────→│──────────────────────→│
    │                        │                       │
    │ SSE: done              │ setPhase('done')      │ 回到就绪
    │───────────────────────→│──────────────────────→│
```

## 组件层级

```
App.tsx
 ├── Header + ThemeToggle + Plugin 选择器
 ├── StatusBar (流水线)
 ├── ChatContainer → MessageBubble × N (react-markdown)
 ├── ConfirmCard (phase=awaiting_confirm 时)
 └── InputBar
```

## 文件说明

| 组件 | 说明 |
|------|------|
| ChatContainer | `messages.length` 驱动自动滚动，`scrollTop` 直接赋值 |
| MessageBubble | `react-markdown` + `remark-gfm` |
| InputBar | processing 时禁用 |
| ConfirmCard | 由 `confirmLabels[toolName]` 驱动标题 |
| StatusBar | 4 步流水线指示器 |
| Header | 标题 + 插件下拉选择器 |
| ThemeToggle | 系统/暗色/亮色三态，localStorage 持久化 |

## 设计系统

- **色彩**: Slate/Warm Gray 极简，CSS Variables token
- **禁止**: 蓝紫渐变
- **响应式**: `640px` 移动端断点
- **字体**: Inter + Noto Sans SC

## 约束

- ❌ 不允许 import `../../plugins/`
- ❌ 不允许 import `../../agent/`
- ❌ 不允许硬编码具体 tool 名称
- ✅ 所有业务信息通过 SSE 事件获取

---

> ⬆️ [返回项目根目录](../../AGENTS.md) · 📋 相关: [shared/](../shared/AGENTS.md) · [server/](../server/AGENTS.md) · 📊 [架构图](../../docs/diagrams/README.md)