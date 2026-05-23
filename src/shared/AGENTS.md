# 共享类型和接口

## 职责

存放跨层共享的接口定义、类型和配置。是依赖方向的终点 —— 其他所有层都可以依赖 shared，shared 不依赖任何其他层。

## 架构

```
shared/
├── AGENTS.md       # 本文档
├── plugin.ts       # BusinessPlugin 接口（系统的核心契约）
├── types.ts        # 领域类型（ChatMessage, LeaveForm 等）
└── config.ts       # 全局配置常量
```

## 接口关系图

```
┌─────────────────────────────────────────────────────────────────┐
│  BusinessPlugin  (plugin.ts) — 系统核心契约                      │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  必填字段    │  │  可选字段    │  │  辅助类型            │  │
│  │              │  │              │  │                      │  │
│  │  id          │  │  fields?     │  │  FieldMeta           │  │
│  │  displayName │  │  validate?   │  │  ValidationResult    │  │
│  │  systemPrompt│  │  submitApi?  │  │  PipelineStep        │  │
│  │  tools       │  │  startProc?  │  │  SubmitResult        │  │
│  │              │  │  confirmTools│  │  ProcessResult       │  │
│  │              │  │  confirmLabel│  │                      │  │
│  │              │  │  suggestions?│  │                      │  │
│  │              │  │  pipeline?   │  │                      │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

BusinessPlugin 被以下层使用:
  server/  → getPlugin() 获取 BusinessPlugin 实例
  agent/   → 读取 plugin.tools / plugin.confirmTools
  plugins/ → 实现 BusinessPlugin 接口
  client/  → 间接使用 (通过 SSE 事件的泛化类型)
```

## 数据结构关系

```
FieldMeta (字段元数据)
  │
  ├── key: string          字段键名
  ├── label: string        中文标签
  ├── type: text|date|     字段类型
  │         select|textarea
  ├── required?: boolean   是否必填
  └── options?: string[]   下拉选项 (type=select 时)

ValidationResult (校验结果)
  ├── valid: boolean
  └── errors: string[]

SubmitResult (提交结果)
  ├── success: boolean
  ├── resultId?: string    (如 FM-xxx, EX-xxx)
  ├── message?: string
  └── form?: Record<string, string>

ProcessResult (流程结果)
  ├── success: boolean
  ├── processId?: string   (如 PS-xxx, EP-xxx)
  └── message?: string

PipelineStep (流水线阶段)
  ├── key: string
  ├── label: string
  └── icon: string
```

## 文件说明

### plugin.ts — 核心接口

`BusinessPlugin` 是整个系统的核心契约。

**必填字段（任何插件都必须提供）:**
- `id` — 唯一标识（如 `leave_approval`）
- `displayName` — UI 显示名称
- `systemPrompt` — Agent 系统提示词
- `tools` — Tool 列表（可以为空数组 `[]`）

**可选字段（按业务需要提供）:**
- `fields` — 审批类需要，聊天类不需要
- `validate` — 有表单校验时提供
- `submitApi` / `startProcessApi` — 有提交/流程时提供
- `confirmTools` — 需要 HITL 时声明 tool 名列表
- `confirmLabels` — HITL 弹窗文案映射
- `suggestions` — 空状态快捷建议语
- `pipeline` — 流水线阶段配置

### types.ts

- `ChatMessage` — 聊天消息结构 (`role` + `content`)
- `LeaveForm` — 远程办公表单（兼容保留）

### config.ts

- `MAX_FORM_RETRIES` — 表单最大重试次数（默认 5）
- `PORT` — 服务端口（默认 3000）

## 依赖方向

```
  server ──→ shared
  agent  ──→ shared
plugins ──→ shared
  client ──→ shared (通过本地 types.ts 间接引用概念)

shared ──→ 无 (终点)
```

## 约束

- ❌ 不允许 import `../agent/`
- ❌ 不允许 import `../plugins/`
- ❌ 不允许 import `../client/`
- ❌ 不允许 import `../server/`
- ✅ 只定义接口和类型，不包含运行时逻辑
- ✅ 是所有层的公共依赖