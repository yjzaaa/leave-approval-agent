# 服务端

> ⬆️ [返回项目根目录](../../AGENTS.md) · 📋 相关: [agent/](../agent/AGENTS.md) · [plugins/](../plugins/AGENTS.md) · [shared/](../shared/AGENTS.md) · [client/](../client/AGENTS.md)

## 职责

Express 服务端，负责 HTTP 路由、SSE 流转发、插件注入。是前端与 Agent 框架之间的桥梁。

## 架构

```
server/
├── AGENTS.md       # 本文档
├── index.ts        # Express 主入口
└── cli.ts          # CLI 交互入口
```

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/plugins` | 返回所有可用插件列表 |
| POST | `/api/chat` | 创建 SSE 流，运行 Agent |
| POST | `/api/confirm` | 用户确认/拒绝 HITL |
| GET | `/*` | 静态文件 (生产模式) |

## 请求处理时序

### POST /api/chat

```
浏览器 → Express → getPlugin() → registry
                 → runAgent({plugin, message, onSSE})
                 → SSE 流式返回 text / confirm_required / done
```

### POST /api/confirm

```
浏览器 → Express → approveConfirm() / rejectConfirm()
                 → confirm-state resolve
                 → tool 继续执行
```

## 文件说明

### index.ts

- `GET /api/plugins` — 遍历 [registry](../plugins/AGENTS.md) 返回插件信息
- `POST /api/chat` — 创建 SSE 流，调用 [agent-factory](../agent/AGENTS.md)
- `POST /api/confirm` — 操作 [confirm-state](../agent/AGENTS.md)
- Vite 代理: `/api` → Express

### cli.ts

- 解析 `--plugin=xxx` 参数
- 从 registry 获取插件
- 命令行交互循环

## 依赖

- [agent/agent-factory.ts](../agent/AGENTS.md) — runAgent
- [agent/confirm-state.ts](../agent/AGENTS.md) — HITL 操作
- [plugins/registry.ts](../plugins/AGENTS.md) — 插件注册表
- [shared/config.ts](../shared/AGENTS.md) — 全局配置

## 约束

- ❌ 不允许定义业务逻辑
- ❌ 不允许直接 import 具体插件
- ✅ 只做路由转发和插件注入

---

> ⬆️ [返回项目根目录](../../AGENTS.md) · 📋 相关: [agent/](../agent/AGENTS.md) · [plugins/](../plugins/AGENTS.md) · 📊 [架构图](../../docs/diagrams/README.md)