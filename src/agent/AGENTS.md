# Agent 框架层

> ⬆️ [返回项目根目录](../../AGENTS.md) · 📋 相关: [plugins/](../plugins/AGENTS.md) · [shared/](../shared/AGENTS.md) · [server/](../server/AGENTS.md)

## 职责

Agent 框架层是整个系统的运行时核心，负责创建和管理 Pi Agent 实例、SSE 事件桥接、以及 HITL 确认状态机。

**核心约束：本层完全业务无关，不知道任何具体 tool 的存在。**

## 架构

```
agent/
├── AGENTS.md           # 本文档
├── agent-factory.ts    # Agent 工厂：创建 Agent、订阅事件、SSE 转发
├── confirm-state.ts    # HITL 通用确认状态机（插件按需使用）
└── types.ts            # 框架级类型定义
```

## 文件说明

### agent-factory.ts

- `runAgent(params)` — 根据 `BusinessPlugin` 创建 Agent 并运行
- `getDefaultModel()` — 获取 DeepSeek 模型配置
- **不 import 任何 tool**，直接使用 `plugin.tools`
- SSE 事件转换: `tool_execution_start → confirm_required` / `message_update → text` / `agent_end → done`

### confirm-state.ts

- `requestConfirm(toolName, data)` — 挂起 Promise，等待用户确认或拒绝
- `approveConfirm()` — 用户确认，Promise resolve(true)
- `rejectConfirm()` — 用户拒绝，Promise resolve(false)
- `getPending()` — 获取当前挂起的确认请求
- 这是一个**通用工具库**，插件按需 import，不是框架强制行为

### types.ts

- 框架级类型定义（AgentFactoryParams 等）

## Agent 运行时序图

```
server/index.ts           agent-factory.ts              Pi Agent               DeepSeek API
     │                          │                          │                        │
     │  runAgent(params)        │                          │                        │
     │─────────────────────────→│                          │                        │
     │                          │  new Agent({             │                        │
     │                          │    tools: plugin.tools,  │                        │
     │                          │    systemPrompt })       │                        │
     │                          │─────────────────────────→│                        │
     │                          │                          │                        │
     │                          │  agent.subscribe(...)    │                        │
     │                          │─────────────────────────→│                        │
     │                          │                          │                        │
     │  ◄─── onSSE('text') ──── │◄── text_delta ────────── │                        │
     │  ◄─── onSSE('confirm') ─ │◄── tool_execution_start │                        │
     │  ◄─── onSSE('done') ──── │◄── agent_end ────────── │                        │
     │                          │                          │                        │
     │                          │  agent.waitForIdle()     │                        │
     │                          │─────────────────────────→│                        │
```

## HITL 状态机流程

```
                    requestConfirm()
                         │
                         ▼
                  ┌──────────────┐
                  │   PENDING    │  Promise 挂起
                  └──┬───────┬───┘
                     │       │
          approveConfirm()  rejectConfirm()
                     │       │
                     ▼       ▼
              RESOLVED     REJECTED
              (true)       (false)
```

## SSE 事件转换映射

```
Pi Agent 事件                 SSE 事件名           前端行为
──────────────────────────────────────────────────────────
message_update (text_delta) → text { content }  → 流式渲染
tool_execution_start        → confirm_required  → 弹确认卡片
                               (仅 confirmTools)
tool_execution_end          → tool_result       → 显示结果
agent_end                   → done {}           → 回到 idle
```

## 依赖

- `@earendil-works/pi-agent-core` — Agent 运行时
- `@earendil-works/pi-ai` — 模型和流式输出
- [shared/plugin.ts](../shared/AGENTS.md) — BusinessPlugin 接口
- [shared/types.ts](../shared/AGENTS.md) — 领域类型

## 约束

- ❌ 不允许 import 任何 `plugins/` 下的模块
- ❌ 不允许定义任何 tool
- ❌ 不允许包含业务逻辑
- ✅ 只通过 `BusinessPlugin` 接口与业务层通信

---

> ⬆️ [返回项目根目录](../../AGENTS.md) · 📋 相关: [plugins/](../plugins/AGENTS.md) · [shared/](../shared/AGENTS.md) · [server/](../server/AGENTS.md) · 📊 [架构图](../../docs/diagrams/README.md)