# 前端 UI 壳层

## 职责

React 前端，负责聊天界面、审批确认弹窗、主题切换。通过 SSE 与后端通信，不关心具体业务逻辑。

**核心约束：前端不知道任何具体业务插件的存在，只通过泛化类型通信。**

## 架构

```
client/
├── AGENTS.md                          # 本文档
├── types.ts                           # 泛化类型 (Message, AgentPhase, ConfirmRequest)
├── hooks/
│   └── useAgent.ts                    # 聊天状态机 Hook (SSE 连接 + 状态管理)
└── components/
    ├── chat/
    │   ├── ChatContainer.tsx          # 消息列表 + 自动滚动
    │   ├── MessageBubble.tsx          # 消息气泡 (Markdown 渲染)
    │   └── InputBar.tsx               # 输入框 + 发送按钮
    ├── approval/
    │   ├── ConfirmCard.tsx            # 通用确认弹窗 (confirmLabels 驱动)
    │   └── StatusBar.tsx              # 流水线进度指示器
    └── layout/
        ├── Header.tsx                 # 顶栏 (标题 + 插件选择器)
        └── ThemeToggle.tsx            # 三态主题切换 (系统/暗色/亮色)
```

## 前端状态机

```
                    用户发送消息
                         │
                         ▼
                  ┌──────────────┐
                  │  processing  │  Agent 工作中，流式渲染文字
                  └──────┬───────┘
                         │
              ┌──────────┴──────────┐
              │                     │
     收到 confirm_required    收到 done / error
              │                     │
              ▼                     ▼
    ┌──────────────────┐    ┌──────────────┐
    │ awaiting_confirm │    │     done     │
    │ 弹出确认卡片     │    │   或 error   │
    └────────┬─────────┘    └──────────────┘
             │
     用户确认/拒绝
     POST /api/confirm
             │
             ▼
    ┌──────────────────┐
    │   processing     │  继续等待 Agent
    └──────────────────┘
```

## SSE 事件处理流程

```
浏览器 EventSource          useAgent.ts             UI 组件
     │                          │                       │
     │  SSE: text { content }   │                       │
     │─────────────────────────→│  appendMessage()      │
     │                          │──────────────────────→│  MessageBubble 渲染
     │                          │                       │
     │  SSE: confirm_required   │                       │
     │  { tool, label, form }   │                       │
     │─────────────────────────→│  setConfirmRequest()  │
     │                          │  setPhase('awaiting') │
     │                          │──────────────────────→│  ConfirmCard 弹出
     │                          │                       │
     │  SSE: confirm_resolved   │                       │
     │─────────────────────────→│  setConfirmReq(null)  │
     │                          │──────────────────────→│  ConfirmCard 关闭
     │                          │                       │
     │  SSE: tool_result        │                       │
     │  { tool, error }         │                       │
     │─────────────────────────→│  appendMessage()      │
     │                          │──────────────────────→│  显示工具结果
     │                          │                       │
     │  SSE: done {}            │                       │
     │─────────────────────────→│  setPhase('done')     │
     │                          │──────────────────────→│  回到就绪态
```

## 组件层级

```
App.tsx
 ├── Header.tsx
 │    ├── ThemeToggle.tsx
 │    └── Plugin 下拉选择器
 │
 ├── StatusBar.tsx (流水线指示器)
 │
 ├── ChatContainer.tsx
 │    └── MessageBubble.tsx × N
 │         └── react-markdown (Markdown 渲染)
 │
 ├── ConfirmCard.tsx (条件渲染, phase=awaiting_confirm)
 │
 └── InputBar.tsx
```

## 文件说明

| 组件 | 说明 |
|------|------|
| ChatContainer | 消息列表，`messages.length` 驱动自动滚动，`scrollTop` 直接赋值 |
| MessageBubble | `react-markdown` + `remark-gfm` 渲染 Markdown |
| InputBar | 输入框，processing 时禁用 |
| ConfirmCard | 由 `confirmLabels[toolName]` 驱动标题和文案 |
| StatusBar | 4 步流水线指示器 |
| Header | 标题 + 插件下拉选择器 |
| ThemeToggle | 系统/暗色/亮色三态循环，localStorage 持久化 |

## 设计系统

- **色彩**: Slate/Warm Gray 极简，CSS Variables token
- **禁止**: 蓝紫渐变、花哨动画
- **响应式**: `640px` 移动端断点
- **主题**: dark/light/system，`prefers-color-scheme` 检测
- **字体**: Inter + Noto Sans SC

## 约束

- ❌ 不允许 import 任何 `plugins/` 下的模块
- ❌ 不允许 import `../../agent/`
- ❌ 不允许硬编码具体 tool 名称（如 `leave_approval_submit`）
- ✅ 所有业务信息通过 SSE 事件和 `PluginInfo` 接口获取
- ✅ ConfirmCard 完全由后端下发的 `confirmLabels` 驱动