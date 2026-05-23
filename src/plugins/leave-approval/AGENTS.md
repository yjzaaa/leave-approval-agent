# 远程办公审批插件 (leave-approval)

## 业务描述

处理远程办公申请的完整审批流程：收集信息 → 校验 → 提交确认 → 发起流程确认。

## 文件说明

| 文件 | 职责 |
|------|------|
| `index.ts` | BusinessPlugin 实例，组装所有配置 |
| `tools.ts` | 全部 Tool 定义（get_current_date, validate, submit, start） |
| `prompt.ts` | System Prompt，指导 Agent 收集远程办公信息 |
| `fields.ts` | 9 个表单字段元数据 |
| `validator.ts` | 字段校验规则（日期、必填等） |
| `api.ts` | Mock API（提交 → FM 前缀，流程 → PS 前缀） |

## 审批流程时序图

```
用户                     Agent (DeepSeek)              Tools                    confirm-state
 │                           │                           │                           │
 │  "我要申请远程办公"       │                           │                           │
 │──────────────────────────→│                           │                           │
 │                           │  调用 get_current_date    │                           │
 │                           │──────────────────────────→│                           │
 │                           │  ◄── 2026-05-23 ──────────│                           │
 │                           │                           │                           │
 │  ◄── "请提供姓名、部门..."│                           │                           │
 │                           │                           │                           │
 │  "张三 技术部 ..."        │                           │                           │
 │──────────────────────────→│                           │                           │
 │                           │                           │                           │
 │                           │  调用 leave_approval_     │                           │
 │                           │  validate                 │                           │
 │                           │──────────────────────────→│                           │
 │                           │  ◄── { valid: true } ────│                           │
 │                           │                           │                           │
 │                           │  调用 leave_approval_     │                           │
 │                           │  submit                   │                           │
 │                           │──────────────────────────→│                           │
 │                           │                           │  requestConfirm()         │
 │                           │                           │──────────────────────────→│
 │                           │                           │  Promise 挂起 ⏳          │
 │                           │                           │                           │
 │  ◄── confirm_required ────│◄── SSE 事件 ─────────────│  ◄── pending ───────────│
 │  (📋 确认提交表单)        │                           │                           │
 │                           │                           │                           │
 │  POST /api/confirm        │                           │                           │
 │  { approved: true }       │                           │                           │
 │───────────────────────────────────────────────────────────────────────────────→│
 │                           │                           │  Promise resolve(true)   │
 │                           │                           │  ◄────────────────────────│
 │                           │                           │                           │
 │                           │                           │  submitApi() → FM-xxx    │
 │                           │  ◄── { resultId: FM-xxx }│                           │
 │                           │                           │                           │
 │                           │  调用 leave_approval_     │                           │
 │                           │  start                    │                           │
 │                           │──────────────────────────→│                           │
 │                           │                           │  requestConfirm()         │
 │                           │                           │──────────────────────────→│
 │  ◄── confirm_required ────│◄── SSE 事件 ─────────────│  Promise 挂起 ⏳          │
 │  (🚀 确认发起审批流程)    │                           │                           │
 │                           │                           │                           │
 │  POST /api/confirm        │                           │                           │
 │  { approved: true }       │                           │                           │
 │───────────────────────────────────────────────────────────────────────────────→│
 │                           │                           │  ◄── resolve(true) ──────│
 │                           │                           │  startProcessApi → PS-xxx│
 │                           │  ◄── { processId: PS-xxx}│                           │
 │                           │                           │                           │
 │  ◄── "流程已发起 PS-xxx"  │                           │                           │
```

## Tool 列表

| Tool 名称 | HITL | 说明 |
|-----------|------|------|
| `get_current_date` | ❌ | 获取当前日期 |
| `leave_approval_validate` | ❌ | 校验表单 |
| `leave_approval_submit` | ✅ | 提交表单，需用户确认 |
| `leave_approval_start` | ✅ | 发起流程，需用户二次确认 |

## HITL 配置

```typescript
confirmTools: ['leave_approval_submit', 'leave_approval_start']
confirmLabels: {
  leave_approval_submit: '📋 确认提交表单',
  leave_approval_start: '🚀 确认发起审批流程',
}
```

## 表单字段

applicantName, department, employeeId, remoteStartDate, remoteEndDate, reason, workPlan, emergencyContact, address (共 9 个，全部必填)

## Mock API

- 提交: 返回 `FM` 前缀 ID
- 流程: 返回 `PS` 前缀 ID