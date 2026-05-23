# 项目规范 — Leave Approval Agent

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
│  │  订阅事件        │  │  requestConfirm()    │                    │
│  │  SSE 事件转换    │  │  approveConfirm()    │                    │
│  └────────┬─────────┘  │  rejectConfirm()    │                    │
│           │            └──────────────────────┘                    │
│           │ 读取 plugin.tools                                       │
│           │ plugin.confirmTools → 判断 HITL                        │
└───────────┼────────────────────────────────────────────────────────┘
            │
            ▼
┌───────────────────────────────────────────────────────────────────┐
│                    业务插件层 (plugins/)                            │
│                                                                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐   │
│  │ leave-approval  │  │expense-approval │  │   sick-leave    │   │
│  │                 │  │                 │  │                 │   │
│  │ tools.ts ★      │  │ tools.ts ★      │  │ tools.ts ★      │   │
│  │ prompt.ts       │  │ prompt.ts       │  │ prompt.ts       │   │
│  │ fields.ts       │  │ fields.ts       │  │ fields.ts       │   │
│  │ validator.ts    │  │ validator.ts    │  │ validator.ts    │   │
│  │ api.ts          │  │ api.ts          │  │ api.ts          │   │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘   │
│                                                                   │
│  每个插件: 自主定义 tools + 自主决定 HITL + 自主实现 API          │
└───────────────────────────────────────────────────────────────────┘
            │
            ▼
┌───────────────────────────────────────────────────────────────────┐
│                      共享层 (shared/)                              │
│  plugin.ts (BusinessPlugin 接口) │ types.ts │ config.ts           │
└───────────────────────────────────────────────────────────────────┘
```

---

## 三层依赖方向图

```
                    ┌──────────┐
                    │  server  │  Express 路由、SSE 桥接
                    └────┬─────┘
                         │ 依赖
                    ┌────▼─────┐
                    │  agent   │  Agent 运行时、HITL 状态机
                    └────┬─────┘
                         │ 依赖
                ┌────────▼────────┐
                │    plugins      │  业务插件 (tools + prompt + api)
                └────────┬────────┘
                         │ 依赖
                    ┌────▼─────┐
                    │  shared  │  接口、类型、配置 (终点，无依赖)
                    └──────────┘

         ┌──────────┐
         │  client  │ ──────────→ shared (前端只依赖共享类型)
         └──────────┘

规则: 依赖严格单向，禁止反向依赖。
      agent/ 不 import plugins/ 下的任何具体模块。
      agent/ 不定义任何 tool。
```

---

## 数据流向图

### 聊天请求 (POST /api/chat)

```
浏览器                     Express                  Agent Framework           DeepSeek API
  │                          │                          │                        │
  │  POST /api/chat          │                          │                        │
  │  { message, history,     │                          │                        │
  │    plugin }              │                          │                        │
  │─────────────────────────→│                          │                        │
  │                          │  getPlugin(id)           │                        │
  │                          │ ──────────┐              │                        │
  │                          │           │ registry     │                        │
  │                          │  ◄─────────┘              │                        │
  │                          │                          │                        │
  │                          │  runAgent({plugin,       │                        │
  │                          │    message, onSSE})      │                        │
  │                          │─────────────────────────→│                        │
  │                          │                          │  new Agent({           │
  │                          │                          │    tools: plugin.tools,│
  │                          │                          │    systemPrompt })     │
  │                          │                          │                        │
  │                          │                          │  agent.prompt(msg)     │
  │                          │                          │───────────────────────→│
  │                          │                          │                        │
  │                          │                          │  ◄── text_delta ───────│
  │  SSE: text { content }   │  ◄── onSSE('text') ──── │                        │
  │◄─────────────────────────│                          │                        │
  │                          │                          │                        │
  │                          │                          │  ◄── tool_call ────────│
  │                          │                          │                        │
  │                          │                          │  execute tool          │
```

### HITL 确认流程

```
浏览器                     Express                  confirm-state             插件 Tool
  │                          │                          │                        │
  │                          │                          │                        │
  │                          │        tool.execute() ──→│                        │
  │                          │                          │  requestConfirm()      │
  │                          │                          │  ◄─────────────────────│
  │                          │                          │  Promise 挂起 ⏳        │
  │                          │                          │                        │
  │  SSE: confirm_required   │  ◄── onSSE() ────────── │                        │
  │  { tool, label, form }   │                          │  getPending() ≠ null   │
  │◄─────────────────────────│                          │                        │
  │                          │                          │                        │
  │  用户点击 确认/拒绝       │                          │                        │
  │  POST /api/confirm       │                          │                        │
  │  { approved: true }      │                          │                        │
  │─────────────────────────→│                          │                        │
  │                          │  approveConfirm()        │                        │
  │                          │─────────────────────────→│                        │
  │                          │                          │  Promise resolve(true) │
  │                          │                          │───────────────────────→│
  │                          │                          │                        │
  │                          │                          │        tool 继续 ──────→│ submitApi()
  │  SSE: confirm_resolved   │  ◄── onSSE() ────────── │                        │
  │◄─────────────────────────│                          │                        │
  │                          │                          │                        │
  │  SSE: tool_result        │  ◄── onSSE() ────────── │                        │
  │◄─────────────────────────│                          │                        │
```

### 插件发现流程 (GET /api/plugins)

```
浏览器                     Express                  registry
  │                          │                          │
  │  GET /api/plugins        │                          │
  │─────────────────────────→│                          │
  │                          │  遍历 registry 所有 key  │
  │                          │─────────────────────────→│
  │                          │  ◄── [{id, displayName,  │
  │                          │       fieldCount}]       │
  │  JSON response           │                          │
  │◄─────────────────────────│                          │
```

---

## 核心原则

1. **框架不知道 tool** — `agent/` 不定义任何 tool，tool 由插件完全自主提供
2. **插件完全自主** — 每个插件自带 prompt + tools + api + validator
3. **HITL 是可选能力** — 框架提供 `confirm-state`，插件按需 import
4. **前端零改动** — 新增插件不需要修改前端代码

## 目录职责

| 目录 | 职责 | 详细文档 |
|------|------|---------|
| `src/agent/` | Agent 框架层（业务无关） | `src/agent/AGENTS.md` |
| `src/plugins/` | 业务插件层（完全自主） | `src/plugins/AGENTS.md` |
| `src/client/` | 前端 UI 壳 | `src/client/AGENTS.md` |
| `src/server/` | Express 服务端 | `src/server/AGENTS.md` |
| `src/shared/` | 共享类型和接口 | `src/shared/AGENTS.md` |

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