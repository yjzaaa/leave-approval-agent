# 报销审批场景 (expense-approval)

> ⬆️ [返回 scenarios/](../CLAUDE.md) · [项目根目录](../../../CLAUDE.md)

## 目录结构

```
expense-approval/
├── index.ts       # Scenario 实例导出
├── tools.ts       # 4 个 Tool 定义
├── prompt.ts      # System Prompt
├── fields.ts      # 表单字段
├── validator.ts   # 校验规则 (金额/类别/日期)
└── api.ts         # Mock API (submit → EX-xxx, process → EP-xxx)
```

## 审批流程图

```mermaid
flowchart TD
    Start([👤 用户: 报销申请]) --> Collect[Agent 收集信息]
    Collect --> Validate{校验通过?}
    Validate -->|❌| Collect
    Validate -->|✅| HITL1["📋 HITL #1: 确认提交"]
    HITL1 -->|拒绝| Collect
    HITL1 -->|确认| Submit["submitApi() → EX-xxx"]
    Submit --> HITL2["🚀 HITL #2: 确认发起"]
    HITL2 -->|拒绝| Collect
    HITL2 -->|确认| Process["startProcessApi() → EP-xxx"]
    Process --> Done([✅ 流程发起成功])

    style Start fill:#dbe4ff,stroke:#495057
    style HITL1 fill:#ffe3e3,stroke:#e03131
    style HITL2 fill:#ffe3e3,stroke:#e03131
    style Done fill:#b2f2bb,stroke:#2b8a3e
```

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

> ⬆️ [返回 scenarios/](../CLAUDE.md) · [项目根目录](../../../CLAUDE.md)