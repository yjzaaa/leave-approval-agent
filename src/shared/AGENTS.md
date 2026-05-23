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

## 文件说明

### plugin.ts — 核心接口

`BusinessPlugin` 是整个系统的核心契约：

**必填字段:**
- `id` — 唯一标识（如 `leave_approval`）
- `displayName` — UI 显示名称
- `systemPrompt` — Agent 系统提示词
- `tools` — Tool 列表（可以为空数组）

**可选字段:**
- `fields` — 表单字段（审批类需要，聊天类不需要）
- `validate` — 校验函数
- `submitApi` — 提交 API
- `startProcessApi` — 流程 API
- `confirmTools` — 需要确认的 tool 列表
- `confirmLabels` — 确认文案映射
- `suggestions` — 空状态建议语
- `pipeline` — 流水线阶段

辅助类型: `FieldMeta`, `ValidationResult`, `PipelineStep`, `SubmitResult`, `ProcessResult`

### types.ts

- `ChatMessage` — 聊天消息结构
- `LeaveForm` — 远程办公表单（兼容保留）

### config.ts

- `MAX_FORM_RETRIES` — 表单最大重试次数（默认 5）
- `PORT` — 服务端口（默认 3000）

## 约束

- ❌ 不允许 import `../agent/`
- ❌ 不允许 import `../plugins/`
- ❌ 不允许 import `../client/`
- ❌ 不允许 import `../server/`
- ✅ 只定义接口和类型，不包含运行时逻辑
- ✅ 是所有层的公共依赖