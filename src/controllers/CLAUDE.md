# Controller 层 — 控制器与业务编排

> ⬆️ [返回 src/](../CLAUDE.md) · 📋 依赖: [models/](../models/CLAUDE.md) · [agent/](../agent/CLAUDE.md) · [infrastructure/](../infrastructure/CLAUDE.md) · 📋 被引用: [views/](../views/CLAUDE.md)

## 职责

Controller 层是 MVC 的 C，包含三层职责：
1. **React Hooks** — Agent 会话管理（useAgent / useAgentCore）
2. **服务端** — Express 路由、SSE 流转发、CLI 入口
3. **业务服务** — 对话/记忆/场景/插件编排

**核心约束：不定义 tool（那是 models/scenarios/ 的职责），不包含 UI 组件（那是 views/ 的职责）。**

## 目录结构

```
controllers/
├── hooks/                     # 🪝 React Agent Hooks
│   ├── useAgentCore.ts            # 纯业务编排（零 React 依赖）
│   └── useAgent.ts                # 薄 React Hook 包装
├── server/                    # 🔧 Express 服务端
│   ├── index.ts                   # Express 主入口（app 组装 + 启动）
│   ├── cli.ts                     # CLI 入口（独立终端模式）
│   ├── controllers/               # 路由处理器
│   │   └── index.ts
│   ├── middleware/                # Express 中间件
│   │   └── index.ts
│   ├── routes/                    # Express 路由
│   │   ├── index.ts                   # 路由汇总导出
│   │   ├── chat.ts                    # POST /api/chat — SSE 流式对话
│   │   ├── confirm.ts                 # POST /api/confirm — HITL 确认
│   │   ├── compact.ts                 # POST /api/compact — 对话压缩
│   │   ├── extract-memories.ts        # POST /api/extract-memories — 记忆提取
│   │   └── scenarios.ts              # GET /api/scenarios — 场景列表
│   └── CLAUDE.md                  # 服务端详细文档
└── services/                  # 🔀 业务服务编排
    ├── chat/                      # 对话服务
    │   └── index.ts
    ├── memory/                    # 记忆服务
    │   └── index.ts
    ├── plugins/                   # 插件服务
    │   └── index.ts
    ├── scenarios/                 # 场景服务
    │   └── index.ts
    └── CLAUDE.md                  # 服务层详细文档
```

## 架构图

```mermaid
graph TD
    subgraph Hooks["hooks/ — React Agent Hooks"]
        UseAgent["useAgent.ts<br/>React 状态管理"]
        UseAgentCore["useAgentCore.ts<br/>Agent 会话编排"]
    end

    subgraph Server["server/ — Express 服务端"]
        Index["index.ts<br/>Express 工厂 (createApp)"]
        CLI["cli.ts<br/>CLI 入口"]
        Routes["routes/<br/>路由定义"]
        MW["middleware/<br/>SSE + 错误处理"]
        Ctrls["controllers/<br/>路由处理器"]
    end

    subgraph Svc["services/ — 业务服务"]
        ChatSvc["chat/<br/>对话服务"]
        MemSvc["memory/<br/>记忆服务"]
        PluginSvc["plugins/<br/>插件服务"]
        ScenarioSvc["scenarios/<br/>场景服务"]
    end

    UseAgent --> UseAgentCore
    Index --> Routes
    Routes --> Ctrls
    Routes --> MW
    Ctrls -->|"调用"| AgentFactory["agent/core/agent-factory"]
    Ctrls -->|"getScenario()"| Registry["models/scenarios/registry"]

    style Hooks fill:#dbe4ff,stroke:#495057,color:#1a1a1a
    style Server fill:#fff9db,stroke:#495057,color:#1a1a1a
    style Svc fill:#f3f0ff,stroke:#495057,color:#1a1a1a
```

## 数据流

```mermaid
graph LR
    subgraph HooksFlow["hooks/ 数据流"]
        View["views/ 组件"]
        UseAgent["useAgent"]
        UseAgentCore["useAgentCore"]
    end

    subgraph ServerFlow["server/ 数据流"]
        Request["HTTP Request"]
        Route["routes/"]
        Ctrl["controllers/"]
    end

    Agent["agent/"]
    Models["models/"]

    View -->|"调用"| UseAgent
    UseAgent -->|"委托"| UseAgentCore
    UseAgentCore -->|"runAgent()"| Agent

    Request --> Route --> Ctrl
    Ctrl -->|"getScenario()"| Models
    Ctrl -->|"runAgent()"| Agent

    style HooksFlow fill:#dbe4ff,stroke:#495057,color:#1a1a1a
    style ServerFlow fill:#fff9db,stroke:#495057,color:#1a1a1a
```

## 时序图 — Vite + Express 单进程模式

```mermaid
sequenceDiagram
    actor User as 👤 用户
    participant Browser as Browser :5173
    participant Vite as Vite Dev Server
    participant Express as Express (中间件)
    participant Route as routes/chat.ts
    participant Factory as agent-factory
    participant API as DeepSeek API

    User->>Browser: 输入消息
    Browser->>Vite: POST /api/chat {message, scenario}
    Vite->>Express: 路由转发
    Express->>Route: chatRouter.handle()
    Route->>Route: new AgentEventBus() + 订阅
    Route->>Factory: startAgent({scenario, eventBus})
    Factory->>API: stream 请求

    loop 流式响应
        API-->>Factory: text_delta
        Factory-->>Express: eventBus.emit('text')
        Express-->>Browser: SSE: text
        Browser-->>User: 流式渲染
    end

    Factory-->>Express: eventBus.emit('done')
    Express-->>Browser: SSE: done
```

## 子模块说明

### hooks/useAgentCore.ts

纯业务编排，零 React 依赖。管理 SSE/Agent 会话，处理 HITL 确认流程、content 内容块转发、记忆注入和压缩触发。所有状态变化通过 `onEvent` 回调通知外部。可被 React Hook、CLI、测试等任意宿主使用。

SSE 事件映射: `text` → 流式文本, `confirm_required` → HITL 确认, `content` → ContentBlock 可视化数据, `done` → 完成。

### hooks/useAgent.ts

薄 React Hook 包装。管理 React 状态（messages, phase, confirmRequest），将 `content` 事件的 ContentBlock 挂载到对应 assistant 消息上，持久化聊天历史到 localStorage，将 `useAgentCore` 的 `onEvent` 映射到 `setState`。

### server/

Express 服务端。`createApp()` 工厂函数供 Vite `configureServer` 和生产独立运行共用。路由拆分到 `routes/` 目录，中间件在 `middleware/`。支持 SSE 流式对话、HITL 确认、对话压缩、记忆提取。

### services/

业务服务编排层（当前为占位文件）。按职责分为对话、记忆、插件、场景四个子目录，未来扩展时填充业务策略逻辑。

## API 端点 (server/)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/scenarios` | 可用场景列表 |
| POST | `/api/chat` | SSE 流，运行 Agent |
| POST | `/api/confirm` | HITL 确认/拒绝 |
| POST | `/api/compact` | 对话压缩 |
| POST | `/api/extract-memories` | 记忆提取 |

## 依赖

- [agent/core/agent-factory.ts](../agent/CLAUDE.md) — runAgent
- [agent/hitl/](../agent/CLAUDE.md) — HitlManager
- [agent/model/](../agent/CLAUDE.md) — getDefaultModel
- [agent/tracing/tracer.ts](../agent/CLAUDE.md) — createTracer
- [models/scenarios/registry.ts](../models/scenarios/CLAUDE.md) — 场景注册表
- [models/domain/](../models/domain/CLAUDE.md) — Scenario, ChatMessage, MemoryItem
- [infrastructure/](../infrastructure/CLAUDE.md) — MEMORY_LIMITS, cn()

## 约束

- 不定义 tool（tool 在 models/scenarios/）
- 不包含 UI 组件（组件在 views/）
- 不直接 import 具体 Scenario 实现，通过 registry 查找
- Express 为可选项，前端 local 模式不依赖 server/

---

> ⬆️ [返回 src/](../CLAUDE.md) · 📋 详细: [server/CLAUDE.md](server/CLAUDE.md) · [services/CLAUDE.md](services/CLAUDE.md)
