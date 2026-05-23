# 业务插件层

> ⬆️ [返回项目根目录](../../AGENTS.md) · 📋 相关: [agent/](../agent/AGENTS.md) · [shared/](../shared/AGENTS.md) · [client/](../client/AGENTS.md)

## 子插件文档

| 插件 | 文档 | 类型 | HITL |
|------|------|------|------|
| 远程办公审批 | [leave-approval/AGENTS.md](leave-approval/AGENTS.md) | 审批类 | 2 步 |
| 报销审批 | [expense-approval/AGENTS.md](expense-approval/AGENTS.md) | 审批类 | 2 步 |
| 病假申请 | [sick-leave/AGENTS.md](sick-leave/AGENTS.md) | 审批类 | 2 步 |

---

## 职责

每个业务插件是一个独立的、自包含的模块，完全拥有自己的 tool 定义、System Prompt、表单字段、校验规则和 API 调用。

**核心原则：插件完全自主，框架不假设插件有哪些 tool。**

## 架构

```
plugins/
├── AGENTS.md                # 本文档
├── registry.ts              # 插件注册表 (getPlugin / getDefaultPlugin)
├── leave-approval/          # 远程办公审批 → [文档](leave-approval/AGENTS.md)
├── expense-approval/        # 报销审批     → [文档](expense-approval/AGENTS.md)
└── sick-leave/              # 病假申请     → [文档](sick-leave/AGENTS.md)
```

## 单个插件内部结构

```
plugins/{name}/
     │
     ├── index.ts ── 导出 BusinessPlugin 实例
     │                ├── import tools.ts     → tools: [...]
     │                ├── import prompt.ts    → systemPrompt
     │                ├── import fields.ts    → fields: [...]
     │                ├── import validator.ts → validate()
     │                └── import api.ts       → submitApi(), startProcessApi()
     │
     └── tools.ts ── 每个 tool 自主定义
                      ├── import confirm-state.js → requestConfirm() (可选)
                      ├── import validator.js     → 校验逻辑
                      └── import api.js           → API 调用
```

## BusinessPlugin 接口

> 完整定义见 [shared/plugin.ts](../shared/AGENTS.md)

```typescript
interface BusinessPlugin {
  id: string;                    // 必填
  displayName: string;           // 必填
  systemPrompt: string;          // 必填
  tools: AgentTool[];            // 必填 (可以为空数组)
  fields?: FieldMeta[];          // 可选
  validate?: (form) => ...;      // 可选
  submitApi?: (form) => ...;     // 可选
  startProcessApi?: (...) => ...;// 可选
  confirmTools?: string[];       // 可选: HITL tool 列表
  confirmLabels?: Record<string, string>; // 可选
  suggestions?: string[];        // 可选
  pipeline?: PipelineStep[];     // 可选
}
```

## 插件类型对比

```
┌──────────────────────┬─────────────┬─────────────┬─────────────┐
│                      │  审批类      │  纯聊天      │  FAQ 咨询   │
├──────────────────────┼─────────────┼─────────────┼─────────────┤
│  tools               │ validate,   │ [] 空       │ [searchKB]  │
│                      │ submit,     │             │             │
│                      │ start       │             │             │
├──────────────────────┼─────────────┼─────────────┼─────────────┤
│  confirmTools        │ submit,     │ 无          │ [] 空       │
│                      │ start       │             │             │
├──────────────────────┼─────────────┼─────────────┼─────────────┤
│  fields              │ ✅ 8-9 个   │ ❌          │ ❌          │
├──────────────────────┼─────────────┼─────────────┼─────────────┤
│  submitApi           │ ✅          │ ❌          │ ❌          │
├──────────────────────┼─────────────┼─────────────┼─────────────┤
│  HITL 模式           │ 两步确认    │ 无          │ 全自动      │
└──────────────────────┴─────────────┴─────────────┴─────────────┘
```

## 新增插件步骤

1. 创建 `plugins/{name}/` 目录
2. 实现必要文件（index.ts 必填，其他按需）
3. 在 `registry.ts` 中注册
4. 前端自动发现，无需改动

## HITL 使用方式

插件 tool 中 import [agent/confirm-state.ts](../agent/AGENTS.md)：

```typescript
import { requestConfirm } from '../../agent/confirm-state.js';
const approved = await requestConfirm('xxx_submit', formData);
if (!approved) throw new Error('用户拒绝');
```

## 依赖

- [agent/confirm-state.ts](../agent/AGENTS.md) — HITL 状态机（按需使用）
- [shared/plugin.ts](../shared/AGENTS.md) — BusinessPlugin 接口
- `@earendil-works/pi-ai` — Tool schema 定义
- `@earendil-works/pi-agent-core` — AgentTool 类型

## 约束

- ❌ 不允许 import `../../server/`
- ❌ 不允许 import `../../client/`
- ✅ 可以 import `../../agent/confirm-state.js`
- ✅ 可以 import `../../shared/`

---

> ⬆️ [返回项目根目录](../../AGENTS.md) · ⬇️ [leave-approval](leave-approval/AGENTS.md) · [expense-approval](expense-approval/AGENTS.md) · [sick-leave](sick-leave/AGENTS.md) · 📊 [架构图](../../docs/diagrams/README.md)