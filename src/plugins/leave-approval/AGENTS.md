# 远程办公审批插件 (leave-approval)

> ⬆️ [返回 plugins/](../AGENTS.md) · [项目根目录](../../../AGENTS.md)

## 审批流程图

```mermaid
flowchart TD
    Start([👤 用户: 申请远程办公]) --> Collect[Agent 收集信息]
    Collect --> Validate{校验通过?}
    Validate -->|❌| Collect
    Validate -->|✅| HITL1["📋 HITL #1: 确认提交"]
    HITL1 -->|拒绝| Collect
    HITL1 -->|确认| Submit["submitApi() → FM-xxx"]
    Submit --> HITL2["🚀 HITL #2: 确认发起"]
    HITL2 -->|拒绝| Collect
    HITL2 -->|确认| Process["startProcessApi() → PS-xxx"]
    Process --> Done([✅ 流程发起成功])

    style Start fill:#dbe4ff,stroke:#495057
    style HITL1 fill:#ffe3e3,stroke:#e03131
    style HITL2 fill:#ffe3e3,stroke:#e03131
    style Done fill:#b2f2bb,stroke:#2b8a3e
    style Validate fill:#fff9db,stroke:#e67700
```

## Tool 列表

| Tool | HITL | 说明 |
|------|------|------|
| `get_current_date` | ❌ | 获取日期 |
| `leave_approval_validate` | ❌ | 校验表单 |
| `leave_approval_submit` | ✅ | 提交确认 |
| `leave_approval_start` | ✅ | 流程确认 |

## 表单字段 (9 个必填)

applicantName, department, employeeId, remoteStartDate, remoteEndDate, reason, workPlan, emergencyContact, address

## Mock API

- 提交 → `FM-xxx` / 流程 → `PS-xxx`

---

> ⬆️ [返回 plugins/](../AGENTS.md) · [项目根目录](../../../AGENTS.md)