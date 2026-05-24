# 值班排班场景 (oncall)

> ⬆️ [返回 scenarios/](../CLAUDE.md) · [项目根目录](../../../CLAUDE.md)

## 业务描述

混合模式场景：查询无需确认 + 换班单步 HITL。

## 目录结构

```
oncall/
├── index.ts       # Scenario 实例导出
├── tools.ts       # 3 个 Tool (query 无 HITL, swap 单步 HITL)
└── api.ts         # Mock API (排班数据 + 换班)
```

## 业务流程图

```mermaid
flowchart TD
    Start([👤 用户: 排班相关]) --> Query{查询 or 换班?}
    Query -->|查询| Q["oncall_query<br/>查询排班 (无 HITL)"]
    Q --> Result([📋 返回排班])
    Query -->|换班| Swap["oncall_swap<br/>换班申请"]
    Swap --> HITL["🔄 HITL: 确认换班"]
    HITL -->|确认| Submit["api.swapApi() → SW-xxx"]
    HITL -->|拒绝| Cancel([取消])

    style Start fill:#dbe4ff,stroke:#495057
    style HITL fill:#ffe3e3,stroke:#e03131
    style Submit fill:#b2f2bb,stroke:#2b8a3e
```

## 换班时序图

```mermaid
sequenceDiagram
    participant User as 👤 用户
    participant Agent as Pi Agent
    participant Query as oncall_query
    participant Swap as oncall_swap
    participant API as Mock API

    User->>Agent: 查询排班
    Agent->>Query: execute()
    Query-->>Agent: 排班数据
    Agent-->>User: 展示排班

    User->>Agent: 申请换班
    Agent->>Swap: execute()
    Note over Swap: HITL — 确认换班
    Swap->>User: confirm_required
    User->>Swap: ✅ 确认
    Swap->>API: swapApi()
    API-->>Swap: SW-xxx
    Swap-->>Agent: 换班成功
    Agent-->>User: ✅ 换班完成
```

## Tool 列表

| Tool | HITL | 说明 |
|------|------|------|
| `get_current_date` | ❌ | 获取日期 |
| `oncall_query` | ❌ | 查询排班 (直接返回) |
| `oncall_swap` | ✅ | 换班申请 (单步确认) |

## 换班流程图

```mermaid
flowchart TD
    Start([👤 查询排班]) --> Query["oncall_query<br/>查询排班 (无 HITL)"]
    Query --> NeedSwap{需要换班?}
    NeedSwap -->|否| Done([结束])
    NeedSwap -->|是| Swap["oncall_swap<br/>换班申请"]
    Swap --> HITL["🔄 HITL: 确认换班"]
    HITL -->|确认| Submit["提交 → SW-xxx"]
    HITL -->|拒绝| Done2([取消])

    style HITL fill:#ffe3e3,stroke:#e03131
    style Submit fill:#b2f2bb,stroke:#2b8a3e
```

## 文件说明

| 文件 | 职责 |
|------|------|
| `index.ts` | Scenario 实例 |
| `tools.ts` | 3 个 tool (query 无 HITL, swap 单步 HITL) |
| `api.ts` | Mock API (排班数据 + 换班) |

---

> ⬆️ [返回 scenarios/](../CLAUDE.md) · [项目根目录](../../../CLAUDE.md)