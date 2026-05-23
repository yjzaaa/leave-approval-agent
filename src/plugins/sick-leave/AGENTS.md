# 病假申请插件 (sick-leave)

> ⬆️ [返回 plugins/](../AGENTS.md) · [项目根目录](../../../AGENTS.md) · 📋 相关: [agent/](../../agent/AGENTS.md) · [shared/](../../shared/AGENTS.md)

## 业务描述

处理病假申请：收集信息 → 校验诊断/日期 → 提交确认 → 流程确认。

## 文件说明

| 文件 | 职责 |
|------|------|
| `index.ts` | BusinessPlugin 实例 |
| `tools.ts` | ★ 全部 Tool 定义 |
| `prompt.ts` | System Prompt |
| `fields.ts` | 9 个表单字段 |
| `validator.ts` | 校验（诊断/医嘱/日期） |
| `api.ts` | Mock API (SL/SP 前缀) |

## Tool 列表

| Tool | HITL | 说明 |
|------|------|------|
| `get_current_date` | ❌ | 获取日期 |
| `sick_leave_validate` | ❌ | 校验 |
| `sick_leave_submit` | ✅ | 提交确认 |
| `sick_leave_start` | ✅ | 流程确认 |

## 特殊校验

- 诊断/医生建议: 非空
- 日期: startDate ≤ endDate，不晚于今天

---

> ⬆️ [返回 plugins/](../AGENTS.md) · [项目根目录](../../../AGENTS.md)