# 报销审批插件 (expense-approval)

> ⬆️ [返回 plugins/](../CLAUDE.md) · [项目根目录](../../../CLAUDE.md)

## 校验流程图

```mermaid
flowchart TD
    Input([表单数据]) --> Required{必填字段<br/>非空?}
    Required -->|❌| Err1["'xxx 不能为空'"]
    Required -->|✅| Amount{金额 > 0<br/>且 ≤ 500000?}
    Amount -->|❌| Err2["'金额范围错误'"]
    Amount -->|✅| Category{类别在枚举中?}
    Category -->|❌| Err3["'无效费用类别'"]
    Category -->|✅| Date{日期 ≤ 今天?}
    Date -->|❌| Err4["'日期不能晚于今天'"]
    Date -->|✅| Pass["✅ { valid: true }"]

    style Input fill:#dbe4ff,stroke:#495057
    style Pass fill:#b2f2bb,stroke:#2b8a3e
    style Err1 fill:#ffe3e3,stroke:#e03131
    style Err2 fill:#ffe3e3,stroke:#e03131
    style Err3 fill:#ffe3e3,stroke:#e03131
    style Err4 fill:#ffe3e3,stroke:#e03131
```

## Tool 列表

| Tool | HITL | 说明 |
|------|------|------|
| `get_current_date` | ❌ | 获取日期 |
| `expense_approval_validate` | ❌ | 校验 |
| `expense_approval_submit` | ✅ | 提交确认 |
| `expense_approval_start` | ✅ | 流程确认 |

## 校验规则

- 金额: > 0 且 ≤ 500000
- 类别: 差旅费/办公用品/招待费/交通费/通讯费/其他
- 日期: ≤ 今天

## Mock API

- 提交 → `EX-xxx` / 流程 → `EP-xxx`

---

> ⬆️ [返回 plugins/](../CLAUDE.md) · [项目根目录](../../../CLAUDE.md)