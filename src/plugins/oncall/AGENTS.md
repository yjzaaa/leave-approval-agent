# 值班排班插件 (oncall)

> ⬆️ [返回 plugins/](../AGENTS.md) · [项目根目录](../../../AGENTS.md)

## 业务描述

混合模式插件：查询无需确认 + 换班单步 HITL。

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
| `index.ts` | BusinessPlugin 实例 |
| `tools.ts` | 3 个 tool (query 无 HITL, swap 单步 HITL) |
| `api.ts` | Mock API (排班数据 + 换班) |

---

> ⬆️ [返回 plugins/](../AGENTS.md) · [项目根目录](../../../AGENTS.md)