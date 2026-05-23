# 共享类型和接口

> ⬆️ [返回项目根目录](../../AGENTS.md) · 📋 被引用: [agent/](../agent/AGENTS.md) · [plugins/](../plugins/AGENTS.md) · [server/](../server/AGENTS.md) · [client/](../client/AGENTS.md)

## 职责

存放跨层共享的接口定义、类型和配置。是依赖方向的终点 —— 其他所有层都可以依赖 shared，shared 不依赖任何其他层。

## 架构

```
shared/
├── AGENTS.md       # 本文档
├── plugin.ts       # BusinessPlugin 接口（系统核心契约）
├── types.ts        # 领域类型
└── config.ts       # 全局配置
```

## 接口关系

```
┌────────────────────────────────────────────────────┐
│  BusinessPlugin  (plugin.ts)                       │
│                                                    │
│  必填: id + displayName + systemPrompt + tools     │
│  可选: fields, validate, submitApi, confirmTools   │
│  └── FieldMeta, ValidationResult, SubmitResult     │
│      PipelineStep, ProcessResult                   │
└────────────────────────────────────────────────────┘
```

> 被以下层使用: [server → getPlugin()](../server/AGENTS.md) · [agent → plugin.tools](../agent/AGENTS.md) · [plugins → 实现](../plugins/AGENTS.md)

## 文件说明

### plugin.ts — 核心接口

- `BusinessPlugin` — 系统核心契约
- `FieldMeta` — 字段元数据 (key, label, type, required, options)
- `ValidationResult` — 校验结果 (valid, errors)
- `SubmitResult` — 提交结果 (success, resultId)
- `ProcessResult` — 流程结果 (success, processId)
- `PipelineStep` — 流水线阶段 (key, label, icon)

### types.ts

- `ChatMessage` — 聊天消息结构 (role + content)
- `LeaveForm` — 远程办公表单（兼容保留）

### config.ts

- `MAX_FORM_RETRIES` — 表单最大重试次数 (默认 5)
- `PORT` — 服务端口 (默认 3000)

## 依赖方向

```
server ──→ shared ←── agent
                   ←── plugins
                   ←── client
shared ──→ 无 (终点)
```

## 约束

- ❌ 不允许 import `../agent/` `../plugins/` `../client/` `../server/`
- ✅ 只定义接口和类型，不包含运行时逻辑

---

> ⬆️ [返回项目根目录](../../AGENTS.md) · 📋 被引用: [agent/](../agent/AGENTS.md) · [plugins/](../plugins/AGENTS.md) · [server/](../server/AGENTS.md) · [client/](../client/AGENTS.md) · 📊 [架构图](../../docs/diagrams/README.md)