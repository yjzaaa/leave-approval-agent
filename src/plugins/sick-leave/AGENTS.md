# 病假申请插件 (sick-leave)

## 业务描述

处理病假申请的审批流程：收集病假信息 → 校验诊断/日期 → 提交确认 → 发起流程确认。

## 文件说明

| 文件 | 职责 |
|------|------|
| `index.ts` | BusinessPlugin 实例 |
| `tools.ts` | 全部 Tool 定义 |
| `prompt.ts` | System Prompt |
| `fields.ts` | 9 个表单字段 |
| `validator.ts` | 校验规则（诊断、医生建议、日期） |
| `api.ts` | Mock API（SL/SP 前缀） |

## Tool 列表

| Tool 名称 | HITL | 说明 |
|-----------|------|------|
| `get_current_date` | ❌ | 获取当前日期 |
| `sick_leave_validate` | ❌ | 校验病假表单 |
| `sick_leave_submit` | ✅ | 提交申请，需确认 |
| `sick_leave_start` | ✅ | 发起审批，需确认 |

## 特殊校验

- 诊断/医生建议: 非空
- 日期: 开始 ≤ 结束，不晚于今天