# 业务插件层

## 职责

每个业务插件是一个独立的、自包含的模块，完全拥有自己的 tool 定义、System Prompt、表单字段、校验规则和 API 调用。

**核心原则：插件完全自主，框架不假设插件有哪些 tool。**

## 架构

```
plugins/
├── AGENTS.md                # 本文档
├── registry.ts              # 插件注册表 (getPlugin / getDefaultPlugin)
├── leave-approval/          # 远程办公审批
│   ├── AGENTS.md            # 插件文档
│   ├── index.ts             # BusinessPlugin 实例
│   ├── tools.ts             # ★ 所有 tool 定义（含 HITL 逻辑）
│   ├── prompt.ts            # System Prompt
│   ├── fields.ts            # 表单字段元数据
│   ├── validator.ts         # 校验规则
│   └── api.ts               # Mock API
├── expense-approval/        # 报销审批
└── sick-leave/              # 病假申请
```

## 单个插件内部结构

```
plugins/{name}/
     │
     │  index.ts ──── 导出 BusinessPlugin 实例
     │                   │
     │                   ├── import tools.ts        → tools: [...]
     │                   ├── import prompt.ts       → systemPrompt
     │                   ├── import fields.ts       → fields: [...]
     │                   ├── import validator.ts    → validate()
     │                   ├── import api.ts          → submitApi(), startProcessApi()
     │                   │
     │                   └── 手动配置:
     │                       ├── confirmTools: ['x_submit', 'x_start']
     │                       ├── confirmLabels: { ... }
     │                       ├── suggestions: [...]
     │                       └── pipeline: [...]
     │
     └── tools.ts ──── 每个 tool 自主定义
                        │
                        ├── import confirm-state.js  → requestConfirm() (可选)
                        ├── import validator.js       → 校验逻辑
                        └── import api.js             → API 调用
```

## 插件注册表时序图

```
server/index.ts          registry.ts          leave-approval/index.ts
     │                       │                        │
     │  getPlugin('leave_approval')                  │
     │──────────────────────→│                        │
     │                       │  import leavePlugin    │
     │                       │───────────────────────→│
     │                       │  ◄── BusinessPlugin ───│
     │  ◄── plugin ──────────│                        │
     │                       │                        │
     │  plugin.tools         │                        │
     │  plugin.systemPrompt  │                        │
     │  plugin.confirmTools  │                        │
     │                       │                        │
```

## BusinessPlugin 接口

```typescript
interface BusinessPlugin {
  id: string;                    // 必填: 唯一标识
  displayName: string;           // 必填: UI 标题
  systemPrompt: string;          // 必填: Agent Prompt
  tools: AgentTool[];            // 必填: tool 列表 (可以为空数组)
  fields?: FieldMeta[];          // 可选: 表单字段
  validate?: (form) => ...;      // 可选: 校验函数
  submitApi?: (form) => ...;     // 可选: 提交 API
  startProcessApi?: (...) => ...; // 可选: 流程 API
  suggestions?: string[];        // 可选: 空状态建议
  confirmTools?: string[];       // 可选: 需要确认的 tool
  confirmLabels?: Record<string, string>; // 可选: 确认文案
  pipeline?: PipelineStep[];     // 可选: 流水线阶段
}
```

## 插件类型对比

```
┌─────────────────────────────────────────────────────────────────┐
│  审批类 (leave / expense / sick-leave)                          │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────┐   │
│  │validate │  │ submit   │  │ start    │  │get_current_date│   │
│  │(无HITL) │  │(有HITL)  │  │(有HITL)  │  │(无HITL)       │   │
│  └─────────┘  └──────────┘  └──────────┘  └───────────────┘   │
│  confirmTools: ['x_submit', 'x_start']                         │
│  fields: ✓ | validate: ✓ | submitApi: ✓ | startProcessApi: ✓  │
├─────────────────────────────────────────────────────────────────┤
│  纯聊天                                                         │
│  tools: []                                                      │
│  confirmTools: 无                                               │
│  fields: ✗ | validate: ✗ | submitApi: ✗ | startProcessApi: ✗  │
├─────────────────────────────────────────────────────────────────┤
│  FAQ 咨询                                                       │
│  ┌──────────────────────┐                                      │
│  │ searchKnowledgeBase  │                                      │
│  │ (无HITL)             │                                      │
│  └──────────────────────┘                                      │
│  confirmTools: []                                               │
│  fields: ✗ | validate: ✗ | submitApi: ✗ | startProcessApi: ✗  │
└─────────────────────────────────────────────────────────────────┘
```

## 新增插件步骤

1. 创建 `plugins/{name}/` 目录
2. 实现必要文件（index.ts 必填，其他按需）
3. 在 `registry.ts` 中注册
4. 前端自动发现，无需改动

## HITL 使用方式

```typescript
// plugins/xxx/tools.ts
import { requestConfirm } from '../../agent/confirm-state.js';

// 在 tool.execute() 中调用
const approved = await requestConfirm('xxx_submit', formData);
if (!approved) throw new Error('用户拒绝');
```

## 依赖

- `../../agent/confirm-state.js` — HITL 状态机（按需使用）
- `../../shared/plugin.js` — BusinessPlugin 接口
- `@earendil-works/pi-ai` — Tool schema 定义 (Type.Object 等)
- `@earendil-works/pi-agent-core` — AgentTool 类型

## 约束

- ❌ 不允许 import `../../server/`
- ❌ 不允许 import `../../client/`
- ✅ 可以 import `../../agent/confirm-state.js`（使用 HITL 能力）
- ✅ 可以 import `../../shared/`（使用共享类型）
- ✅ 每个 tool 的 HITL 逻辑由插件自己决定