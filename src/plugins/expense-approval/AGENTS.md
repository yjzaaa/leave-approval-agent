# 报销审批插件 (expense-approval)

> ⬆️ [返回 plugins/](../AGENTS.md) · [项目根目录](../../../AGENTS.md) · 📋 相关: [agent/](../../agent/AGENTS.md) · [shared/](../../shared/AGENTS.md)

## 业务描述

处理报销申请：收集信息 → 校验金额/类别 → 提交确认 → 流程确认。

## 文件说明

| 文件 | 职责 |
|------|------|
| `index.ts` | BusinessPlugin 实例 |
| `tools.ts` | ★ 全部 Tool 定义 |
| `prompt.ts` | System Prompt |
| `fields.ts` | 8 个表单字段 |
| `validator.ts` | 校验（金额/类别/日期） |
| `api.ts` | Mock API (EX/EP 前缀) |

## Tool 列表

| Tool | HITL | 说明 |
|------|------|------|
| `get_current_date` | ❌ | 获取日期 |
| `expense_approval_validate` | ❌ | 校验 |
| `expense_approval_submit` | ✅ | 提交确认 |
| `expense_approval_start` | ✅ | 流程确认 |

## 特殊校验

- 金额: > 0 且 ≤ 500000
- 类别: 差旅费/办公用品/招待费/交通费/通讯费/其他
- 日期: 不晚于今天

---

> ⬆️ [返回 plugins/](../AGENTS.md) · [项目根目录](../../../AGENTS.md)