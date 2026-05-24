# 服务层 — 业务逻辑编排

> ⬆️ [返回项目根目录](../../CLAUDE.md) · 📋 依赖: [domain/](../domain/CLAUDE.md) · [infrastructure/](../infrastructure/CLAUDE.md) · [agent/](../agent/CLAUDE.md) · 📋 被引用: [server/](../server/CLAUDE.md) · [client/](../client/CLAUDE.md)

## 职责

服务层编排业务逻辑，将 Agent 框架能力与业务需求连接起来。区别于场景层（定义"做什么"），服务层定义"怎么做"。

**核心约束：服务层不定义 tool，不包含 UI，不处理 HTTP 请求。**

## 架构

```
services/
├── chat/              # 对话服务
│   ├── chat-service.ts     # 对话编排（消息路由、上下文构建）
│   └── compact-service.ts  # 对话压缩（摘要生成策略）
├── memory/            # 记忆服务
│   ├── memory-service.ts   # 记忆 CRUD 编排
│   └── extract-service.ts  # 记忆提取（结构化提取策略）
└── scenarios/           # 场景服务
    ├── registry.ts         # 场景注册表（从 scenarios/registry.ts 迁移）
    └── discovery.ts        # 场景发现（动态导入 + 元数据）
```

## 各子目录说明

### chat/ — 对话服务

对话编排层，负责消息路由、上下文构建、流式响应处理。

| 模块 | 说明 |
|------|------|
| `chat-service.ts` | 对话生命周期管理：创建会话、发送消息、处理 SSE 事件流 |
| `compact-service.ts` | 对话压缩策略：消息计数、触发阈值判断、摘要生成编排 |

**设计原则**: 服务层不直接操作 Agent 实例，通过 `agent-factory` 的 `runAgent()` 接口通信。

### memory/ — 记忆服务

记忆存储和提取的业务编排。

| 模块 | 说明 |
|------|------|
| `memory-service.ts` | 记忆 CRUD 编排：容量检查、FIFO 淘汰、跨场景隔离 |
| `extract-service.ts` | 记忆提取编排：构建提取 prompt、解析 AI 返回、去重合并 |

**与 infrastructure/memory/ 的区别**:
- `infrastructure/memory/store.ts` — 纯函数（创建空存储、查询记忆）
- `services/memory/` — 业务编排（何时提取、如何淘汰、策略决策）

### scenarios/ — 场景服务

场景注册、发现、生命周期管理。

| 模块 | 说明 |
|------|------|
| `registry.ts` | 场景注册表：静态注册 + 动态查找 |
| `discovery.ts` | 场景发现：扫描 scenarios/ 目录、读取元数据、构建 ScenarioInfo |

## 依赖方向

```mermaid
graph TD
    Services["services/"]
    Domain["domain/"]
    Infra["infrastructure/"]
    Agent["agent/"]
    Plugins["scenarios/"]

    Services --> Domain
    Services --> Infra
    Services --> Agent
    Services --> Plugins

    style Services fill:#fff4e6,stroke:#495057,color:#1a1a1a
```

## 数据流

```mermaid
graph LR
    subgraph Input["入口"]
        Client["client/hooks/"]
        Server["server/index.ts"]
    end

    subgraph SvcChat["services/chat/"]
        ChatSvc["chat-service"]
        CompactSvc["compact-service"]
    end

    subgraph SvcMem["services/memory/"]
        MemSvc["memory-service"]
        ExtractSvc["extract-service"]
    end

    subgraph SvcPlugin["services/scenarios/"]
        Reg["registry"]
        Disc["discovery"]
    end

    Client -->|"local 模式"| ChatSvc
    Server -->|"server 模式"| ChatSvc
    ChatSvc -->|"压缩触发"| CompactSvc
    ChatSvc -->|"记忆注入"| MemSvc
    MemSvc -->|"提取触发"| ExtractSvc
    ChatSvc -->|"场景查找"| Reg

    style Input fill:#dbe4ff,stroke:#495057,color:#1a1a1a
    style SvcChat fill:#fff4e6,stroke:#495057,color:#1a1a1a
    style SvcMem fill:#ebfbee,stroke:#495057,color:#1a1a1a
    style SvcPlugin fill:#f3f0ff,stroke:#495057,color:#1a1a1a
```

## 服务调用时序图

```mermaid
sequenceDiagram
    participant Caller as server/ 或 client
    participant ChatSvc as chat-service
    participant PluginSvc as scenarios/registry
    participant Agent as agent/core
    participant DeepSeek as DeepSeek API

    Caller->>ChatSvc: send(message, scenarioId)
    ChatSvc->>PluginSvc: getScenario(id)
    PluginSvc-->>ChatSvc: Scenario
    ChatSvc->>ChatSvc: buildContext(memories, summary)
    ChatSvc->>Agent: runAgent({scenario, message, ...})
    Agent->>DeepSeek: stream 请求

    loop 流式响应
        DeepSeek-->>Agent: text_delta
        Agent-->>ChatSvc: onSSE('text')
        ChatSvc-->>Caller: 流式数据
    end

    Agent-->>ChatSvc: done
    ChatSvc->>ChatSvc: checkCompact(messages)
    ChatSvc-->>Caller: 完成
```

## 与其他层的对比

| 层 | 定义 | 举例 |
|----|------|------|
| `domain/` | 数据类型 | `ChatMessage`, `MemoryItem` |
| `infrastructure/` | 纯函数/常量 | `createEmptyStore()`, `MEMORY_LIMITS` |
| `agent/` | Agent 运行时（业务无关） | `runAgent()`, `HitlManager` |
| `scenarios/` | 业务定义（自主） | `leave-approval/tools.ts`, `Scenario` |
| **`services/`** | **业务编排（策略）** | **何时压缩对话、如何淘汰记忆** |

## 约束

- ✅ 可以 import `domain/`, `infrastructure/`, `agent/`, `scenarios/`
- ✅ 可以包含业务逻辑和策略决策
- ❌ 不定义 tool（那是 scenario 的职责）
- ❌ 不直接操作 HTTP request/response（那是 server 的职责）
- ❌ 不包含 UI 组件（那是 client 的职责）
- ❌ 不 import `server/` 或 `client/`

---

> ⬆️ [返回项目根目录](../../CLAUDE.md) · 📋 依赖: [domain/](../domain/CLAUDE.md) · [infrastructure/](../infrastructure/CLAUDE.md) · [agent/](../agent/CLAUDE.md)
