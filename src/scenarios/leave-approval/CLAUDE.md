# 远程办公审批场景 (leave-approval)

> ⬆️ [返回 scenarios/](../CLAUDE.md) · [项目根目录](../../../CLAUDE.md)

## 目录结构

```
leave-approval/
├── index.ts       # Scenario 实例导出
├── tools.ts       # 4 个 Tool 定义
├── prompt.ts      # System Prompt
├── fields.ts      # 9 个表单字段
├── validator.ts   # 校验规则
└── api.ts         # Mock API (submit → FM-xxx, process → PS-xxx)
```

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

## 数据流

```mermaid
graph LR
    User["👤 用户输入"] --> Agent["Agent<br/>信息收集"]
    Agent -->|校验| Validate["leave_approval_validate"]
    Validate -->|通过| Submit["leave_approval_submit<br/>HITL #1"]
    Submit -->|确认| API["api.submitApi()<br/>→ FM-xxx"]
    API --> Start["leave_approval_start<br/>HITL #2"]
    Start -->|确认| Process["api.startProcessApi()<br/>→ PS-xxx"]

    style Submit fill:#ffe3e3,stroke:#e03131
    style Start fill:#ffe3e3,stroke:#e03131
```

## 审批时序图

```mermaid
sequenceDiagram
    participant User as 👤 用户
    participant Agent as Pi Agent
    participant Tool as leave-approval tools
    participant API as Mock API

    User->>Agent: 申请远程办公
    Agent->>Tool: validate(form)
    Tool-->>Agent: { valid: true }

    Agent->>Tool: submit(form)
    Note over Tool: HITL #1 — 确认提交
    Tool->>User: confirm_required
    User->>Tool: ✅ 确认
    Tool->>API: submitApi(form)
    API-->>Tool: FM-xxx

    Agent->>Tool: start(formId, form)
    Note over Tool: HITL #2 — 确认发起
    Tool->>User: confirm_required
    User->>Tool: ✅ 确认
    Tool->>API: startProcessApi(formId, form)
    API-->>Tool: PS-xxx

    Agent-->>User: ✅ 流程发起成功
```

---

> ⬆️ [返回 scenarios/](../CLAUDE.md) · [项目根目录](../../../CLAUDE.md)