# 报销审批插件 (expense-approval)

## 业务描述

处理报销申请的审批流程：收集报销信息 → 校验金额/类别 → 提交确认 → 发起流程确认。

## 文件说明

| 文件 | 职责 |
|------|------|
| `index.ts` | BusinessPlugin 实例 |
| `tools.ts` | 全部 Tool 定义 |
| `prompt.ts` | System Prompt |
| `fields.ts` | 8 个表单字段 |
| `validator.ts` | 校验规则（金额范围、类别枚举、日期） |
| `api.ts` | Mock API（EX/EP 前缀） |

## Tool 列表

| Tool 名称 | HITL | 说明 |
|-----------|------|------|
| `get_current_date` | ❌ | 获取当前日期 |
| `expense_approval_validate` | ❌ | 校验报销表单 |
| `expense_approval_submit` | ✅ | 提交报销，需确认 |
| `expense_approval_start` | ✅ | 发起审批，需确认 |

## 校验流程图

```
输入表单
    │
    ▼
┌─────────────┐    ┌─────────────────────────────┐
│ 金额校验    │───→│ > 0 且 ≤ 500000 ?           │
└─────────────┘    └──────────┬──────────────────┘
                              │ 通过
                              ▼
┌─────────────┐    ┌─────────────────────────────┐
│ 类别校验    │───→│ 差旅费/办公用品/招待费/      │
└─────────────┘    │ 交通费/通讯费/其他 ?         │
                   └──────────┬──────────────────┘
                              │ 通过
                              ▼
┌─────────────┐    ┌─────────────────────────────┐
│ 日期校验    │───→│ 不晚于今天 ?                 │
└─────────────┘    └──────────┬──────────────────┘
                              │ 通过
                              ▼
                   { valid: true, errors: [] }
```

## HITL 配置

```typescript
confirmTools: ['expense_approval_submit', 'expense_approval_start']
confirmLabels: {
  expense_approval_submit: '📋 确认报销信息',
  expense_approval_start: '🚀 确认发起报销审批',
}
```

## Mock API

- 提交: 返回 `EX` 前缀 ID
- 流程: 返回 `EP` 前缀 ID