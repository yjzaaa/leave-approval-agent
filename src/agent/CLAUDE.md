# Agent 框架层

> ⬆️ [返回项目根目录](../../CLAUDE.md) · 📋 相关: [plugins/](../plugins/CLAUDE.md) · [shared/](../shared/CLAUDE.md) · [server/](../server/CLAUDE.md)

## 职责

Agent 框架层是运行时核心，创建和管理 Pi Agent 实例、SSE 事件桥接、HITL 确认状态机。

**核心约束：本层完全业务无关，不定义任何 tool。**

## 架构

```
agent/
├── CLAUDE.md           # 本文档
├── agent-factory.ts    # 创建 Agent、SSE 转发
├── hitl.ts             # HitlManager 类 + withConfirm 包装器
├── memory-prompt.ts    # 记忆格式化注入 system prompt
├── mlflow-tracer.ts    # MLflow 追踪 (可选)
└── types.ts            # 框架级类型
```

## Agent 运行时序图

```mermaid
sequenceDiagram
    participant Server as server/index.ts
    participant Factory as agent-factory
    participant Agent as Pi Agent
    participant API as DeepSeek API

    Server->>Factory: runAgent({plugin, message, onSSE})
    Factory->>Agent: new Agent({tools: plugin.tools})
    Factory->>Agent: agent.prompt(message)
    Agent->>API: stream 请求

    loop 流式响应
        API-->>Agent: text_delta
        Agent-->>Factory: message_update
        Factory-->>Server: onSSE('text')
    end

    alt tool 调用 (在 confirmTools 中)
        Agent->>Factory: tool_execution_start
        Factory-->>Server: onSSE('confirm_required')
        Server-->>Factory: POST /api/confirm
        Factory->>Agent: continue
    end

    Agent-->>Factory: agent_end
    Factory-->>Server: onSSE('done')
```

## HITL 状态机

```mermaid
stateDiagram-v2
    [*] --> Idle

    Idle --> Pending : tool 调用 requestConfirm()

    state Pending {
        [*] --> Waiting
        Waiting : Promise 挂起 ⏳
        Waiting : SSE 推送 confirm_required
    }

    Pending --> Approved : POST /api/confirm {approved: true}
    Pending --> Rejected : POST /api/confirm {approved: false}

    Approved --> Executing : resolve(true) → 执行 API
    Rejected --> Aborted : resolve(false) → throw Error

    Executing --> Idle
    Aborted --> Idle

    Idle --> Idle : tool 不在 confirmTools → 直接执行
```

## SSE 事件转换

| Pi Agent 事件 | SSE 事件 | 前端行为 |
|--------------|---------|---------|
| message_update (text_delta) | `text { content }` | 流式渲染 |
| tool_execution_start (confirmTools) | `confirm_required` | 弹确认卡片 |
| tool_execution_end | `tool_result` | 显示结果 |
| agent_end | `done {}` | 回到 idle |

## 文件说明

### agent-factory.ts

- `runAgent(params)` — 创建 Agent，订阅事件，SSE 转发
- `getDefaultModel()` — DeepSeek 模型配置
- 不 import 任何 tool，直接使用 `plugin.tools`

### hitl.ts

- `HitlManager` — HITL 确认管理器类
  - `requestConfirm()` — 挂起 Promise，事件驱动 SSE
  - `approve()` / `reject()` — 解除挂起
  - `pending` — 当前待确认项（只读）
- `withConfirm()` — 声明式 HITL 工具包装器
- `wrapHitlTools()` — 批量包装 HITL tools（agent-factory 使用）

### memory-prompt.ts

- `formatMemoriesForPrompt(memories)` — 将记忆列表格式化为 system prompt 区块
- `formatSummaryForHistory(summary)` — 将对话摘要格式化为 history 注入
- 按 user/feedback/project/reference 分组输出

## 依赖

- `@earendil-works/pi-agent-core` / `@earendil-works/pi-ai`
- `shared/plugin.ts` · `shared/types.ts`

## 约束

- ❌ 不 import plugins/ 下的任何模块
- ❌ 不定义任何 tool
- ✅ 只通过 BusinessPlugin 接口通信

---

> ⬆️ [返回项目根目录](../../CLAUDE.md) · 📋 相关: [plugins/](../plugins/CLAUDE.md) · [shared/](../shared/CLAUDE.md) · [server/](../server/CLAUDE.md)