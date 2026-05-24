# src/ 源码架构

> ⬆️ [返回项目根目录](../CLAUDE.md)

## 目录结构

```
src/
├── domain/            # 🧱 领域模型 (models/DTO/VO/interfaces) — 零外部依赖
├── infrastructure/    # 🏗️ 基础设施 (errors/utils/constants/memory)
├── shared/            # ⚠️ 弃用中 → 迁移到 domain/ + infrastructure/
├── agent/             # ⚙️ Agent 框架层 (业务无关)
│   ├── core/              # agent-factory, types
│   ├── hitl/              # HITL 确认状态机
│   ├── tracing/           # MLflow 追踪
│   ├── memory/            # 记忆注入 prompt
│   └── local/             # 浏览器端辅助
├── services/          # 🔀 业务编排 (对话/记忆/场景发现)
├── scenarios/         # 📦 业务场景 (完全自主: prompt + tools + api + validator)
├── client/            # 🎨 前端 UI 壳 (React + Vite)
├── server/            # 🔧 Express 服务端 (可选)
├── i18n/              # 🌐 多语言翻译 (i18next)
├── App.tsx            # 主应用组件
└── App.css            # 墨韵设计系统样式
```

## 子目录文档

| 层 | 目录 | 文档 | 说明 |
|---|------|------|------|
| 🧱 | `domain/` | [CLAUDE.md](domain/CLAUDE.md) | 领域模型 — models/DTO/VO/接口 |
| 🏗️ | `infrastructure/` | [CLAUDE.md](infrastructure/CLAUDE.md) | 基础设施 — 错误/工具/常量/记忆运行时 |
| ⚙️ | `agent/` | [CLAUDE.md](agent/CLAUDE.md) | Agent 框架层 (业务无关) |
| 🔀 | `services/` | [CLAUDE.md](services/CLAUDE.md) | 服务层 — 业务逻辑编排 |
| 📦 | `scenarios/` | [CLAUDE.md](scenarios/CLAUDE.md) | 业务场景层 |
| 🎨 | `client/` | [CLAUDE.md](client/CLAUDE.md) | 前端 UI 壳层 |
| 🔧 | `server/` | [CLAUDE.md](server/CLAUDE.md) | Express 服务端 |
| 🌐 | `i18n/` | — | 多语言翻译 (i18next) |

## 系统架构图

```mermaid
graph TB
    subgraph UI["🖥️ UI 层"]
        Browser["🌐 Browser<br/>React + Vite"]
        CLI["⌨️ CLI<br/>Node.js"]
    end

    subgraph Server["🔧 服务层"]
        API["Express :3000<br/>POST /api/chat<br/>POST /api/confirm"]
        SSE["SSE Bridge<br/>EventSource 流"]
    end

    subgraph Services["🔀 业务编排"]
        ChatSvc["chat/service.ts<br/>对话编排"]
        MemSvc["memory/service.ts<br/>记忆编排"]
        ScenarioSvc["scenarios/service.ts<br/>场景发现"]
    end

    subgraph Agent["⚙️ 框架层 (业务无关)"]
        Factory["agent-factory.ts<br/>创建 Agent"]
        HitlMgr["hitl.ts<br/>HITL 状态机"]
        Tracer["mlflow-tracer.ts<br/>MLflow 追踪"]
    end

    subgraph Scenarios["📦 场景层"]
        Leave["远程办公审批"]
        Expense["报销审批"]
        Sick["病假申请"]
    end

    subgraph Domain["🧱 领域层"]
        Models["models/<br/>领域实体"]
        DTOs["dto/<br/>数据传输"]
        VOs["vo/<br/>视图对象"]
        Interfaces["interfaces/<br/>契约接口"]
    end

    subgraph Infra["🏗️ 基础设施"]
        Errors["errors/<br/>错误体系"]
        Utils["utils/<br/>工具函数"]
        Constants["constants/<br/>全局常量"]
        MemoryRT["memory/<br/>记忆运行时"]
    end

    Browser --> API
    Browser -.->|"local 模式"| Services
    CLI --> Services
    API --> SSE
    SSE --> Services
    Services --> Agent
    Services --> Scenarios
    Agent --> Scenarios
    Agent --> Infra
    Scenarios --> Domain
    Services --> Domain
    Server --> Domain
    UI --> Domain
    Agent --> Domain
    Infra --> Domain

    style UI fill:#dbe4ff,stroke:#495057,color:#1a1a1a
    style Server fill:#fff9db,stroke:#495057,color:#1a1a1a
    style Services fill:#f3f0ff,stroke:#495057,color:#1a1a1a
    style Agent fill:#e7f5ff,stroke:#495057,color:#1a1a1a
    style Scenarios fill:#fff4e6,stroke:#495057,color:#1a1a1a
    style Domain fill:#ebfbee,stroke:#495057,color:#1a1a1a
    style Infra fill:#f8f9fa,stroke:#495057,color:#1a1a1a
```

## 依赖方向图

```mermaid
graph TD
    Domain["domain/<br/>模型·DTO·VO·接口"]
    Infra["infrastructure/<br/>错误·工具·常量·记忆运行时"]
    Agent["agent/<br/>Agent 运行时"]
    Scenarios["scenarios/<br/>业务场景"]
    Services["services/<br/>业务编排"]
    Server["server/<br/>Express 路由"]
    Client["client/<br/>React 前端"]

    Domain --> Infra
    Server -->|"依赖"| Services
    Services -->|"依赖"| Agent
    Agent -->|"依赖"| Scenarios
    Agent -->|"依赖"| Infra
    Scenarios -->|"依赖"| Domain
    Services -->|"依赖"| Domain
    Server -->|"依赖"| Domain
    Client -->|"依赖"| Domain
    Client -.->|"local 模式"| Services

    style Domain fill:#ebfbee,stroke:#495057,color:#1a1a1a
    style Infra fill:#f8f9fa,stroke:#495057,color:#1a1a1a
    style Services fill:#f3f0ff,stroke:#495057,color:#1a1a1a
    style Agent fill:#e7f5ff,stroke:#495057,color:#1a1a1a
    style Scenarios fill:#fff4e6,stroke:#495057,color:#1a1a1a
    style Server fill:#fff9db,stroke:#495057,color:#1a1a1a
    style Client fill:#dbe4ff,stroke:#495057,color:#1a1a1a
```

## 记忆系统

```mermaid
graph LR
    subgraph Frontend["🖥️ 前端"]
        LS["localStorage<br/>MemoryStore"]
        Hook["useMemory.ts"]
        Panel["MemoryPanel.tsx"]
    end

    subgraph AgentLayer["⚙️ 框架层"]
        Format["agent/memory/<br/>memory-prompt.ts"]
    end

    subgraph Infra["🏗️ 基础设施"]
        Types["infrastructure/memory/<br/>运行时函数"]
    end

    subgraph DomainLayer["🧱 领域层"]
        MemTypes["domain/models/<br/>记忆类型+常量"]
    end

    Hook --> LS
    Hook --> Panel
    Hook --> Types
    Format --> Types
    AgentLayer --> Format
    Types --> DomainLayer

    style Frontend fill:#dbe4ff,stroke:#495057,color:#1a1a1a
    style AgentLayer fill:#e7f5ff,stroke:#495057,color:#1a1a1a
    style Infra fill:#f8f9fa,stroke:#495057,color:#1a1a1a
    style DomainLayer fill:#ebfbee,stroke:#495057,color:#1a1a1a
```

**设计原则**: 服务端无状态，前端 localStorage 持久化。

| 记忆类型 | 作用域 | 说明 |
|---------|--------|------|
| user | 跨场景共享 | 用户画像/偏好 |
| feedback | 跨场景共享 | 用户纠正/确认 |
| project | 按场景隔离 | 业务上下文 |
| reference | 按场景隔离 | 外部资源指针 |

## 聊天请求时序图

**Server 模式** (Express 中转):

```mermaid
sequenceDiagram
    actor User as 👤 用户
    participant Browser as Browser
    participant Express as Express :3000
    participant Factory as agent-factory
    participant DeepSeek as DeepSeek API

    User->>Browser: 输入消息
    Browser->>Express: POST /api/chat {message, scenario}
    Express->>Factory: runAgent({scenario, message, onSSE})
    Factory->>Factory: new Agent({tools: scenario.tools})

    loop 流式响应
        Factory-->>Express: onSSE('text', {content})
        Express-->>Browser: SSE: text
        Browser-->>User: 流式渲染
    end

    Factory-->>Express: onSSE('done', {})
    Express-->>Browser: SSE: done
```

**Local 模式** (浏览器直接调用 Agent，无网络往返):

```mermaid
sequenceDiagram
    actor User as 👤 用户
    participant Browser as Browser
    participant Factory as agent-factory (in-browser)
    participant DeepSeek as DeepSeek API

    User->>Browser: 输入消息
    Browser->>Factory: runAgent({scenario, message, onSSE})
    Factory->>Factory: new Agent({tools: scenario.tools})

    loop 流式响应
        Factory-->>Browser: onSSE('text', {content})
        Browser-->>User: 流式渲染
    end

    Factory-->>Browser: onSSE('done', {})
```

## HITL 确认流程时序图

**Server 模式** (通过 HTTP):

```mermaid
sequenceDiagram
    actor User as 👤 用户
    participant Browser as Browser
    participant Express as Express
    participant Hitl as HitlManager
    participant Tool as 场景 Tool

    Note over Tool: tool.execute() 中
    Tool->>Hitl: requestConfirm(toolName, form)
    Note over Hitl: Promise 挂起 ⏳
    Note over Express: onHitlCreated 在 agent.prompt() 之前注册

    Hitl-->>Browser: SSE: confirm_required
    Browser-->>User: 弹出确认卡片 📋

    alt 用户确认 ✅
        User->>Browser: 点击确认
        Browser->>Express: POST /api/confirm {approved: true}
        Express->>Hitl: approve()
        Hitl-->>Tool: resolve(true)
        Tool->>Tool: 执行 submitApi()
    else 用户拒绝 ❌
        User->>Browser: 点击拒绝
        Browser->>Express: POST /api/confirm {approved: false}
        Express->>Hitl: reject()
        Hitl-->>Tool: resolve(false)
        Tool->>Tool: throw Error
    end
```

**Local 模式** (直接操作 HitlManager):

```mermaid
sequenceDiagram
    actor User as 👤 用户
    participant Browser as Browser
    participant Hitl as HitlManager
    participant Tool as 场景 Tool

    Note over Tool: tool.execute() 中
    Tool->>Hitl: requestConfirm(toolName, form)
    Note over Hitl: Promise 挂起 ⏳

    Hitl-->>Browser: onEvent → React setState
    Browser-->>User: 弹出确认卡片 📋

    alt 用户确认 ✅
        User->>Browser: 点击确认
        Browser->>Hitl: hitl.approve() (直接调用)
        Hitl-->>Tool: resolve(true)
        Tool->>Tool: 执行 submitApi()
    else 用户拒绝 ❌
        User->>Browser: 点击拒绝
        Browser->>Hitl: hitl.reject() (直接调用)
        Hitl-->>Tool: resolve(false)
        Tool->>Tool: throw Error
    end
```

---

> ⬆️ [返回项目根目录](../CLAUDE.md)
