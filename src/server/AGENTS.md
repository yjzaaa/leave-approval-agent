# 服务端

## 职责

Express 服务端，负责 HTTP 路由、SSE 流转发、插件注入。是前端与 Agent 框架之间的桥梁。

## 架构

```
server/
├── AGENTS.md       # 本文档
├── index.ts        # Express 主入口 (路由 + 静态文件)
└── cli.ts          # CLI 交互入口 (--plugin=xxx)
```

## 请求处理时序图

### 聊天请求 (POST /api/chat)

```
浏览器                 Express (index.ts)        agent-factory         confirm-state
  │                          │                        │                      │
  │  POST /api/chat          │                        │                      │
  │  { message, history,     │                        │                      │
  │    plugin }              │                        │                      │
  │─────────────────────────→│                        │                      │
  │                          │                        │                      │
  │                          │  设置 SSE 响应头:       │                      │
  │                          │  Content-Type: text/   │                      │
  │                          │  event-stream           │                      │
  │                          │                        │                      │
  │                          │  getPlugin(pluginId)   │                      │
  │                          │  ────────┐              │                      │
  │                          │  ◄───────┘              │                      │
  │                          │                        │                      │
  │                          │  runAgent({            │                      │
  │                          │    plugin, message,    │                      │
  │                          │    onSSE: (evt,data)=> │                      │
  │                          │      res.write(...)    │                      │
  │                          │  })                    │                      │
  │                          │───────────────────────→│                      │
  │                          │                        │                      │
  │  SSE event stream ◄──── │◄─── onSSE callbacks ── │                      │
  │                          │                        │                      │
  │                          │                        │  (HITL 发生时)       │
  │                          │                        │─────────────────────→│
  │                          │                        │  requestConfirm()    │
  │                          │                        │  ◄───────────────────│
  │                          │                        │                      │
```

### 确认请求 (POST /api/confirm)

```
浏览器                 Express (index.ts)        confirm-state         插件 Tool
  │                          │                        │                      │
  │  POST /api/confirm       │                        │                      │
  │  { approved: true }      │                        │                      │
  │─────────────────────────→│                        │                      │
  │                          │  approveConfirm()      │                      │
  │                          │───────────────────────→│                      │
  │                          │                        │  Promise resolve     │
  │                          │                        │─────────────────────→│
  │                          │                        │                      │  继续执行
  │  ◄── 200 OK ────────────│                        │                      │
```

### 插件列表 (GET /api/plugins)

```
浏览器                 Express (index.ts)        registry
  │                          │                        │
  │  GET /api/plugins        │                        │
  │─────────────────────────→│                        │
  │                          │  遍历 registry         │
  │                          │───────────────────────→│
  │                          │  ◄── plugin list ──────│
  │                          │                        │
  │                          │  过滤: id, displayName │
  │                          │  fieldCount            │
  │                          │                        │
  │  ◄── JSON [{id, name,   │                        │
  │       fieldCount}] ──────│                        │
```

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/plugins` | 返回所有可用插件列表 |
| POST | `/api/chat` | 创建 SSE 流，运行 Agent |
| POST | `/api/confirm` | 用户确认/拒绝 HITL 请求 |
| GET | `/*` | 静态文件 (生产模式从 dist/) |

## 文件说明

### index.ts

- `GET /api/plugins` — 遍历 registry 返回插件信息
- `POST /api/chat` — 接收 `{ message, history, plugin }`，创建 SSE 流
- `POST /api/confirm` — 接收 `{ approved }`，操作 confirm-state
- 静态文件: 生产模式从 `dist/` 提供
- Vite 代理: 开发模式 `/api` → Express

### cli.ts

- 解析 `--plugin=xxx` 参数
- 从 registry 获取插件
- 创建 Pi Agent 实例，命令行交互循环
- 支持 `exit` 退出、`reset` 重置对话

## 依赖

- `../agent/agent-factory.js` — runAgent
- `../agent/confirm-state.js` — HITL 状态操作
- `../plugins/registry.js` — 插件注册表
- `../shared/config.js` — 全局配置

## 约束

- ❌ 不允许定义业务逻辑
- ❌ 不允许直接 import 具体插件（通过 registry 间接获取）
- ✅ 只做路由转发和插件注入
- ✅ SSE 流直接转发 agent 事件，不做业务解析