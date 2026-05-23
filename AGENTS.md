# 项目规范 — Leave Approval Agent

> **⬇️ 子目录文档导航**
>
> | 层 | 目录 | 文档 | 说明 |
> |---|------|------|------|
> | 🎨 | `src/client/` | [AGENTS.md](src/client/AGENTS.md) | 前端 UI 壳层 |
> | 🔧 | `src/server/` | [AGENTS.md](src/server/AGENTS.md) | Express 服务端 |
> | ⚙️ | `src/agent/` | [AGENTS.md](src/agent/AGENTS.md) | Agent 框架层 (业务无关) |
> | 📦 | `src/plugins/` | [AGENTS.md](src/plugins/AGENTS.md) | 业务插件层 |
> | 📋 | `src/shared/` | [AGENTS.md](src/shared/AGENTS.md) | 共享类型和接口 |
>
> **延伸阅读:** 各子目录 [AGENTS.md](src/client/AGENTS.md) 包含层内详细文档

---

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

    subgraph Agent["⚙️ 框架层 (业务无关)"]
        Factory["agent-factory.ts<br/>创建 Agent"]
        Confirm["confirm-state.ts<br/>HITL 状态机"]
    end

    subgraph Plugins["📦 插件层"]
        Leave["远程办公审批"]
        Expense["报销审批"]
        Sick["病假申请"]
    end

    subgraph Shared["📋 共享层"]
        Interface["BusinessPlugin 接口"]
    end

    Browser --> API
    CLI --> Factory
    API --> SSE
    SSE --> Factory
    Factory --> Confirm
    Factory --> Plugins
    Plugins --> Shared
    Agent --> Shared

    style UI fill:#dbe4ff,stroke:#495057,color:#1a1a1a
    style Server fill:#fff9db,stroke:#495057,color:#1a1a1a
    style Agent fill:#e7f5ff,stroke:#495057,color:#1a1a1a
    style Plugins fill:#fff4e6,stroke:#495057,color:#1a1a1a
    style Shared fill:#ebfbee,stroke:#495057,color:#1a1a1a
```

## 三层依赖方向图

```mermaid
graph TD
    Server["server/<br/>Express 路由"]
    Agent["agent/<br/>Agent 运行时"]
    Plugins["plugins/<br/>业务插件"]
    Client["client/<br/>React 前端"]
    Shared["shared/<br/>接口与类型"]

    Server -->|"依赖"| Agent
    Agent -->|"依赖"| Plugins
    Plugins -->|"依赖"| Shared
    Agent -.->|"依赖"| Shared
    Client -.->|"依赖"| Shared

    style Server fill:#fff9db,stroke:#495057,color:#1a1a1a
    style Agent fill:#e7f5ff,stroke:#495057,color:#1a1a1a
    style Plugins fill:#fff4e6,stroke:#495057,color:#1a1a1a
    style Client fill:#dbe4ff,stroke:#495057,color:#1a1a1a
    style Shared fill:#ebfbee,stroke:#495057,color:#1a1a1a
```

## 记忆系统

```mermaid
graph LR
    subgraph Frontend["🖥️ 前端"]
        LS["localStorage<br/>MemoryStore"]
        Hook["useMemory.ts"]
        Panel["MemoryPanel.tsx"]
    end

    subgraph Agent["⚙️ 框架层"]
        Format["memory-prompt.ts<br/>格式化注入"]
    end

    subgraph Shared["📋 共享层"]
        Types["memory.ts<br/>类型 + 常量"]
    end

    Hook --> LS
    Hook --> Panel
    Hook --> Types
    Format --> Types
    Agent --> Format

    style Frontend fill:#dbe4ff,stroke:#495057,color:#1a1a1a
    style Agent fill:#e7f5ff,stroke:#495057,color:#1a1a1a
    style Shared fill:#ebfbee,stroke:#495057,color:#1a1a1a
```

**设计原则**: 服务端无状态，前端 localStorage 持久化。

| 记忆类型 | 作用域 | 说明 |
|---------|--------|------|
| user | 跨插件共享 | 用户画像/偏好 |
| feedback | 跨插件共享 | 用户纠正/确认 |
| project | 按插件隔离 | 业务上下文 |
| reference | 按插件隔离 | 外部资源指针 |

## 聊天请求时序图

```mermaid
sequenceDiagram
    actor User as 👤 用户
    participant Browser as Browser
    participant Express as Express :3000
    participant Factory as agent-factory
    participant DeepSeek as DeepSeek API

    User->>Browser: 输入消息
    Browser->>Express: POST /api/chat {message, plugin}
    Express->>Factory: runAgent({plugin, message, onSSE})
    Factory->>Factory: new Agent({tools: plugin.tools})

    loop 流式响应
        Factory-->>Express: onSSE('text', {content})
        Express-->>Browser: SSE: text
        Browser-->>User: 流式渲染
    end

    Factory-->>Express: onSSE('done', {})
    Express-->>Browser: SSE: done
```

## HITL 确认流程时序图

```mermaid
sequenceDiagram
    actor User as 👤 用户
    participant Browser as Browser
    participant State as confirm-state
    participant Tool as 插件 Tool

    Note over Tool: tool.execute() 中
    Tool->>State: requestConfirm(toolName, form)
    Note over State: Promise 挂起 ⏳

    State-->>Browser: SSE: confirm_required
    Browser-->>User: 弹出确认卡片 📋

    alt 用户确认 ✅
        User->>Browser: 点击确认
        Browser->>State: POST /api/confirm {approved: true}
        State-->>Tool: resolve(true)
        Tool->>Tool: 执行 submitApi()
    else 用户拒绝 ❌
        User->>Browser: 点击拒绝
        Browser->>State: POST /api/confirm {approved: false}
        State-->>Tool: resolve(false)
        Tool->>Tool: throw Error
    end
```

## 核心原则

1. **框架不知道 tool** — `agent/` 不定义任何 tool，tool 由插件完全自主提供
2. **插件完全自主** — 每个插件自带 prompt + tools + api + validator
3. **HITL 是可选能力** — 框架提供 `confirm-state`，插件按需 import
4. **前端零改动** — 新增插件不需要修改前端代码

## 目录职责

| 目录 | 职责 | 详细文档 |
|------|------|---------|
| `src/agent/` | Agent 框架层（业务无关） | [AGENTS.md](src/agent/AGENTS.md) |
| `src/plugins/` | 业务插件层（完全自主） | [AGENTS.md](src/plugins/AGENTS.md) |
| `src/client/` | 前端 UI 壳 | [AGENTS.md](src/client/AGENTS.md) |
| `src/server/` | Express 服务端 | [AGENTS.md](src/server/AGENTS.md) |
| `src/shared/` | 共享类型和接口 | [AGENTS.md](src/shared/AGENTS.md) |

## 编码规范

- 所有方法、类、重要步骤必须有中文注释
- 文件编码: UTF-8 (无 BOM)
- 命名: TypeScript camelCase，文件 kebab-case
- 组件: React 函数式组件 + Hooks
- 样式: 墨韵设计系统，CSS Variables token，禁止蓝紫渐变
- 字体: Crimson Pro + Noto Serif SC + IBM Plex Mono + Noto Sans SC
- 主题: 墨韵 (warm paper + ink-dark + vermillion accent)，dark/light/system
- 依赖注入: 通过 `BusinessPlugin` 接口，禁止直接 import 具体业务

## 构建和运行

```bash
npm run dev:all       # Express :3000 + Vite :5173
npm run dev:server    # 仅后端
npm run dev           # 仅前端
npm run build         # 生产构建
npm run cli           # CLI 模式
npm run cli -- --plugin=xxx  # 指定插件
```

## Git 规范

- 分支: `feature/pi-framework`
- 提交格式: `type: 描述` (feat/fix/refactor/docs/chore)
- 提交描述使用中文

## 端口

- Express: `3000` / Vite dev: `5173` / 代理 `/api` → `:3000`

---

> **延伸阅读:** 各子目录 [AGENTS.md](src/client/AGENTS.md) 包含层内详细文档