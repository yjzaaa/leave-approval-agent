# 远程办公审批插件 (leave-approval)

> ⬆️ [返回 plugins/](../AGENTS.md) · [项目根目录](../../../AGENTS.md) · 📋 相关: [agent/](../../agent/AGENTS.md) · [shared/](../../shared/AGENTS.md)

## 业务描述

处理远程办公申请的完整审批流程：收集信息 → 校验 → 提交确认 → 发起流程确认。

## 文件说明

| 文件 | 职责 |
|------|------|
| `index.ts` | BusinessPlugin 实例 |
| `tools.ts` | ★ 全部 Tool 定义（含 HITL） |
| `prompt.ts` | System Prompt |
| `fields.ts` | 9 个表单字段 |
| `validator.ts` | 校验规则 |
| `api.ts` | Mock API (FM/PS 前缀) |

## Tool 列表

| Tool | HITL | 说明 |
|------|------|------|
| `get_current_date` | ❌ | 获取日期 |
| `leave_approval_validate` | ❌ | 校验表单 |
| `leave_approval_submit` | ✅ | 提交确认 |
| `leave_approval_start` | ✅ | 流程确认 |

## HITL 配置

```typescript
confirmTools: ['leave_approval_submit', 'leave_approval_start']
```

## 表单字段 (9 个必填)

applicantName, department, employeeId, remoteStartDate, remoteEndDate, reason, workPlan, emergencyContact, address

---

> ⬆️ [返回 plugins/](../AGENTS.md) · [项目根目录](../../../AGENTS.md) · 📊 [审批流程图](../../../docs/diagrams/approval-workflow.excalidraw)