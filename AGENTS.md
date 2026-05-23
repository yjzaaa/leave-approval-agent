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
> **延伸阅读:** [DESIGN.md](docs/DESIGN.md) · [架构图](docs/diagrams/README.md)

---

## 项目概述

插件化审批 Agent 系统，基于 Pi Agent Framework。支持多种业务（审批、聊天、咨询）接入，框架层完全业务无关。

## 技术栈

- **前端**: React 18 + Vite 6 + TypeScript, CSS Variables 主题
- **后端**: Express + SSE, Pi Agent Framework
- **AI**: DeepSeek API (via `@earendil-works/pi-ai`)
- **模型**: deepseek-v4-pro

---

## 系统架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                           用户 (Browser / CLI)                       │
└──────────┬──────────────────────────────────────────────┬───────────┘
           │ HTTP / SSE                                   │ stdin/stdout
           ▼                                              ▼
┌──────────────────────┐                    ┌──────────────────────┐
│   Vite Dev Server    │                    │                      │
│   :5173 (开发代理)    │                    │    CLI (cli.ts)      │
│   /api → :3000       │                    │    --plugin=xxx      │
└──────────┬───────────┘                    └──────────┬───────────┘
           │                                           │
           ▼                                           ▼
┌───────────────────────────────────────────────────────────────────┐
│                        Express Server (:3000)                      │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────────┐  │
│  │ GET         │  │ POST        │  │ POST                     │  │
│  │ /api/plugins│  │ /api/chat   │  │ /api/confirm             │  │
│  └─────────────┘  └──────┬──────┘  └────────────┬─────────────┘  │
└───────────────────────────┼─────────────────────┼────────────────┘
                            │                     │
                            ▼                     │
┌─────────────────────────────────────────────────┼─────────────────┐
│                    Agent 框架层 (agent/)         │                 │
│                                                 │                 │
│  ┌──────────────────┐  ┌──────────────────────┐ │                 │
│  │  agent-factory   │  │  confirm-state       │◄┘                 │
│  │  创建 Agent      │  │  HITL 状态机         │                    │
│  └────────┬─────────┘  └──────────────────────┘                    │
│           │ 读取 plugin.tools / plugin.confirmTools                │
└───────────┼────────────────────────────────────────────────────────┘
            │
            ▼
┌───────────────────────────────────────────────────────────────────┐
│                    业务插件层 (plugins/)                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐   │
│  │ leave-approval  │  │expense-approval │  │   sick-leave    │   │
│  │ tools ★         │  │ tools ★         │  │ tools ★         │   │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘   │
└───────────────────────────────────────────────────────────────────┘
            │
            ▼
┌───────────────────────────────────────────────────────────────────┐
│  shared/ — BusinessPlugin 接口 │ types.ts │ config.ts             │
└───────────────────────────────────────────────────────────────────┘
```

> 📊 **可视化版本:** [system-architecture.excalidraw](docs/diagrams/system-architecture.excalidraw)

---

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
- 换行符: LF (git 自动转换)
- 命名: TypeScript camelCase，文件 kebab-case
- 组件: React 函数式组件 + Hooks
- 样式: CSS Variables token 体系，禁止蓝紫渐变
- 主题: Slate/Warm Gray 极简，支持 dark/light/system
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
- 每次提交确保 `tsc --noEmit` 和 `vite build` 通过

## 端口

- Express: `3000`
- Vite dev: `5173`
- Vite 代理 `/api` → `http://localhost:3000`

---

> **延伸阅读:** [DESIGN.md](docs/DESIGN.md) · [架构图索引](docs/diagrams/README.md)