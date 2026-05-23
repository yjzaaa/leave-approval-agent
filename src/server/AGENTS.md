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

## 文件说明

### index.ts

- `GET /api/plugins` — 返回所有可用插件列表
- `POST /api/chat` — 接收 `{ message, history, plugin }`，创建 SSE 流，调用 `runAgent()`
- `POST /api/confirm` — 接收 `{ approved }`，调用 `approveConfirm()` 或 `rejectConfirm()`
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