# 病假申请场景 (sick-leave)

> ⬆️ [返回 scenarios/](../CLAUDE.md) · [项目根目录](../../../CLAUDE.md)

## 目录结构

```
sick-leave/
├── index.ts       # Scenario 实例导出
├── tools.ts       # 4 个 Tool 定义
├── prompt.ts      # System Prompt
├── fields.ts      # 表单字段
├── validator.ts   # 校验规则 (诊断/医嘱/日期)
└── api.ts         # Mock API (submit → SL-xxx, process → SP-xxx)
```

## 审批流程图

```mermaid
flowchart TD
    Start([👤 用户: 病假申请]) --> Collect[Agent 收集信息]
    Collect --> Validate{校验通过?}
    Validate -->|❌| Collect
    Validate -->|✅| HITL1["📋 HITL #1: 确认提交"]
    HITL1 -->|拒绝| Collect
    HITL1 -->|确认| Submit["submitApi() → SL-xxx"]
    Submit --> HITL2["🚀 HITL #2: 确认发起"]
    HITL2 -->|拒绝| Collect
    HITL2 -->|确认| Process["startProcessApi() → SP-xxx"]
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
    Required -->|✅| Diagnosis{诊断非空?}
    Diagnosis -->|❌| Err2["'诊断不能为空'"]
    Diagnosis -->|✅| DoctorNote{医嘱非空?}
    DoctorNote -->|❌| Err3["'医嘱不能为空'"]
    DoctorNote -->|✅| Date{开始 ≤ 结束<br/>且 ≤ 今天?}
    Date -->|❌| Err4["'日期错误'"]
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
| `sick_leave_validate` | ❌ | 校验 |
| `sick_leave_submit` | ✅ | 提交确认 |
| `sick_leave_start` | ✅ | 流程确认 |

## 校验规则

- 诊断/医生建议: 非空
- 日期: startDate ≤ endDate，≤ 今天

## Mock API

- 提交 → `SL-xxx` / 流程 → `SP-xxx`

---

> ⬆️ [返回 scenarios/](../CLAUDE.md) · [项目根目录](../../../CLAUDE.md)