# 远程办公申请自动化审批 Agent — 设计文档 v3.2

> **框架**: Pi Agent Framework (`@earendil-works/pi-agent-core` + `@earendil-works/pi-ai`)
> **模型**: DeepSeek V4 Pro
> **分支**: `feature/pi-framework`
> **前端**: React 18 + Vite 6 + TypeScript
> **架构**: 插件化三层分离（Agent 框架 / 业务插件 / UI 壳）

---

## 1. 核心原则

| 原则 | 说明 |
|------|------|
| **框架不知道 tool** | agent/ 不定义任何 tool，tool 完全由插件提供 |
| **插件完全自主** | 每个插件自带 prompt + tools + api + validator |
| **HITL 是可选能力** | 框架提供 confirm-state，插件决定哪个 tool 用它 |
| **业务多样性** | 审批类、咨询类、纯聊天，都用同一个框架 |

## 2. BusinessPlugin 接口

```typescript
interface BusinessPlugin {
  id: string;                    // 唯一标识
  displayName: string;           // UI 标题
  fields?: FieldMeta[];          // 表单字段（审批类需要，聊天类不需要）
  systemPrompt: string;          // Agent System Prompt
  tools: AgentTool[];            // 完全由插件定义的 tool 列表
  validate?: (form) => ValidationResult;  // 校验（可选）
  submitApi?: (form) => Promise<...>;     // 提交 API（可选）
  startProcessApi?: (id, form) => Promise<...>;  // 流程 API（可选）
  suggestions?: string[];        // 空状态快捷建议语
  confirmTools?: string[];       // HITL: 需要用户确认的 tool 列表
  confirmLabels?: Record<string, string>;  // HITL: 确认文案
  pipeline?: PipelineStep[];     // 流水线阶段（可选）
}
```

**只有 `id`、`displayName`、`systemPrompt`、`tools` 是必填。**
其余全是可选 —— 纯聊天插件只需要 prompt + 空 tools 即可。

## 3. Tool 定义权

### 之前的问题

```
❌ agent/tools/submit-form.ts   — 框架假设业务有 submit
❌ agent/tools/start-process.ts — 框架假设业务有 start_process
❌ agent/tools/validate-form.ts — 框架假设业务有 validate
问题：纯聊天不需要任何 tool，FAQ 只需 search tool
```

### 现在的设计

```
✅ agent/
     agent-factory.ts     — 创建 Agent，tool 从 plugin.tools 读取
     confirm-state.ts     — HITL 通用状态机（插件可选 import）

✅ plugins/leave-approval/
     tools.ts             — ★ 所有 tool 定义在这里（插件自己 import confirm-state）
     prompt.ts / validator.ts / api.ts / fields.ts / index.ts

✅ plugins/pure-chat/     (假设的纯聊天插件)
     tools: []            — 空数组
     prompt.ts            — 聊天 prompt
```

### 插件如何使用 HITL

```typescript
// plugins/leave-approval/tools.ts
import { requestConfirm } from '../../agent/confirm-state.js';

export function buildLeaveTools() {
  return [
    getCurrentDateTool,
    validateTool,
    {
      name: 'leave_approval_submit',
      execute: async (_id, params) => {
        // ★ 插件自己决定调用 requestConfirm
        const approved = await requestConfirm('leave_approval_submit', params.form);
        if (!approved) throw new Error('用户拒绝');
        return await submitLeaveForm(params.form);
      }
    },
  ];
}
```

## 4. HITL 模式

| 模式 | 插件做法 | 场景 |
|------|---------|------|
| 多步确认 | tool 内部调用 `requestConfirm()` + 声明 `confirmTools` | 审批类 |
| 单步确认 | 只有部分 tool 调用 `requestConfirm()` | 低风险 |
| 无 HITL | 不调用 `requestConfirm()`，`confirmTools` 为空 | 聊天/FAQ |

`confirmTools` 的作用：告诉 SSE 桥接层哪些 tool 需要推送 `confirm_required` 到前端。

## 5. 目录结构

```
src/
├── agent/                            # ⚙️ 框架层（无 tool 定义）
│   ├── agent-factory.ts              #   创建 Agent，读 plugin.tools
│   ├── confirm-state.ts              #   HITL 通用状态机
│   └── types.ts
│
├── plugins/                          # 📦 业务层（完全自主）
│   ├── registry.ts
│   ├── leave-approval/
│   │   ├── tools.ts                  #   ★ tool 定义在这里
│   │   ├── prompt.ts / fields.ts / validator.ts / api.ts / index.ts
│   ├── expense-approval/
│   └── sick-leave/
│
├── client/                           # 🖥️ 前端
├── server/                           # 🔧 服务端
└── shared/                           # 📋 共享
    └── plugin.ts                     #   BusinessPlugin 接口
```

**`agent/tools/` 目录删除，tool 定义全部移入各 plugins。**

## 6. 扩展示例

### 审批类

```typescript
tools: [getCurrentDate, validate, submit, start],
confirmTools: ['x_submit', 'x_start'],
```

### 纯聊天

```typescript
tools: [],
// 无 fields, validate, submitApi, confirmTools
```

### FAQ 咨询

```typescript
tools: [searchKnowledgeBase],
confirmTools: [],
```

## 7. 关键决策

| 决策 | 原因 | 日期 |
|------|------|------|
| HITL 由业务决定 | confirmTools 让插件控制 | 2026-05-23 |
| **Tool 定义权下放 plugins** | 框架不假设业务有哪些 tool | 2026-05-23 |
| **confirm-state 是工具库** | 插件按需 import | 2026-05-23 |
| **submitApi 等变为可选** | 不是所有业务都有提交/流程 | 2026-05-23 |