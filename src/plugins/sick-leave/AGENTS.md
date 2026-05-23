# 病假申请插件 (sick-leave)

> ⬆️ [返回 plugins/](../AGENTS.md) · [项目根目录](../../../AGENTS.md)

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

> ⬆️ [返回 plugins/](../AGENTS.md) · [项目根目录](../../../AGENTS.md)