# 业务场景层

> ⬆️ [返回项目根目录](../../CLAUDE.md) · 📋 相关: [agent/](../agent/CLAUDE.md) · [shared/](../shared/CLAUDE.md)

## 子场景文档

| 场景 | 文档 | 类型 | HITL |
|------|------|------|------|
| 远程办公审批 | [leave-approval/CLAUDE.md](leave-approval/CLAUDE.md) | 审批类 | 2 步 |
| 报销审批 | [expense-approval/CLAUDE.md](expense-approval/CLAUDE.md) | 审批类 | 2 步 |
| 病假申请 | [sick-leave/CLAUDE.md](sick-leave/CLAUDE.md) | 审批类 | 2 步 |
| 智能助手 | [pure-chat/CLAUDE.md](pure-chat/CLAUDE.md) | 纯聊天 | 无 |
| 政策咨询 | [faq/CLAUDE.md](faq/CLAUDE.md) | FAQ 咨询 | 无 |
| 值班排班 | [oncall/CLAUDE.md](oncall/CLAUDE.md) | 混合型 | 1 步 |

## 职责

每个场景完全自主：自带 prompt + tools + api + validator。框架不假设场景有哪些 tool。

## 目录结构

```
scenarios/
├── registry.ts              # 场景注册表 — getScenario() / getDefaultScenario()
├── leave-approval/          # 远程办公审批
│   ├── index.ts                 # Scenario 导出
│   ├── tools.ts                 # Tool 定义
│   ├── prompt.ts                # System Prompt
│   ├── fields.ts                # 表单字段
│   ├── validator.ts             # 校验规则
│   └── api.ts                   # Mock API
├── expense-approval/        # 报销审批
│   └── ... (同 leave-approval 结构)
├── sick-leave/              # 病假申请
│   └── ...
├── pure-chat/               # 纯聊天
│   └── index.ts
├── faq/                     # 政策咨询
│   └── index.ts
└── oncall/                  # 值班排班
    └── index.ts
```

## 场景数据流

```mermaid
graph LR
    Registry["registry.ts<br/>getScenario(id)"]
    Leave["leave-approval"]
    Expense["expense-approval"]
    Sick["sick-leave"]
    Chat["pure-chat"]
    FAQ["faq"]
    Oncall["oncall"]

    Server["server/<br/>Express"]
    Client["client/<br/>React"]

    Registry --> Leave
    Registry --> Expense
    Registry --> Sick
    Registry --> Chat
    Registry --> FAQ
    Registry --> Oncall

    Server -->|"getScenario()"| Registry
    Client -->|"GET /api/plugins"| Registry

    style Registry fill:#fff4e6,stroke:#495057,color:#1a1a1a
```

## 场景类型对比图

```mermaid
graph LR
    subgraph Approval["📋 审批类"]
        A1["tools: validate + submit + start"]
        A2["confirmTools: submit, start"]
        A3["fields: ✅ 有表单"]
    end

    subgraph Chat["💬 纯聊天"]
        C1["tools: [] 空"]
        C2["confirmTools: 无"]
        C3["fields: ❌ 无"]
    end

    subgraph FAQ["🔍 FAQ 咨询"]
        F1["tools: [searchKB]"]
        F2["confirmTools: [] 空"]
        F3["fields: ❌ 无"]
    end

    Interface["Scenario<br/>id + displayName +<br/>systemPrompt + tools"]

    Interface -.-> Approval
    Interface -.-> Chat
    Interface -.-> FAQ

    style Approval fill:#fff4e6,stroke:#495057,color:#1a1a1a
    style Chat fill:#dbe4ff,stroke:#495057,color:#1a1a1a
    style FAQ fill:#ebfbee,stroke:#495057,color:#1a1a1a
    style Interface fill:#f3f3f0,stroke:#495057,color:#1a1a1a
```

## 单个场景内部结构

```mermaid
graph TD
    Index["index.ts<br/>导出 Scenario"] --> Tools["tools.ts ★<br/>全部 Tool 定义"]
    Index --> Prompt["prompt.ts<br/>System Prompt"]
    Index --> Fields["fields.ts<br/>表单字段"]
    Index --> Validator["validator.ts<br/>校验规则"]
    Index --> API["api.ts<br/>后端 API"]

    Tools -->|"可选 import"| Confirm["agent/confirm-state.ts<br/>requestConfirm()"]
    Tools --> Validator
    Tools --> API

    style Tools fill:#ffc078,stroke:#495057,color:#1a1a1a
    style Index fill:#fff4e6,stroke:#495057,color:#1a1a1a
    style Confirm fill:#a5d8ff,stroke:#495057,color:#1a1a1a
```

## 场景注册时序图

```mermaid
sequenceDiagram
    participant Server as server/index.ts
    participant Registry as registry.ts
    participant Scenario as xxx/index.ts

    Server->>Registry: getScenario('leave_approval')
    Registry->>Scenario: import
    Scenario-->>Registry: Scenario 实例
    Registry-->>Server: scenario {tools, systemPrompt, ...}
    Server->>Server: scenario.tools → agent-factory
```

## Scenario 接口

> 完整定义见 [shared/plugin.ts](../shared/CLAUDE.md)

| 字段 | 必填 | 说明 |
|------|------|------|
| `id` | ✅ | 唯一标识 |
| `displayName` | ✅ | UI 标题 |
| `systemPrompt` | ✅ | Agent Prompt |
| `tools` | ✅ | Tool 列表 (可以为空) |
| `fields` | ❌ | 表单字段 |
| `validate` | ❌ | 校验函数 |
| `submitApi` | ❌ | 提交 API |
| `startProcessApi` | ❌ | 流程 API |
| `confirmTools` | ❌ | HITL tool 列表 |
| `confirmLabels` | ❌ | 确认文案 |
| `suggestions` | ❌ | 空状态建议 |
| `pipeline` | ❌ | 流水线阶段 |

## 新增场景步骤

1. 创建 `scenarios/{name}/` 目录
2. 实现必要文件
3. 在 `registry.ts` 注册
4. 前端零改动

## 依赖

- [agent/confirm-state.ts](../agent/CLAUDE.md) — 按需使用
- [shared/plugin.ts](../shared/CLAUDE.md) — Scenario

## 约束

- ❌ 不 import `../../server/` `../../client/`
- ✅ 可 import `../../agent/confirm-state.js`
- ✅ 可 import `../../shared/`

---

> ⬆️ [返回项目根目录](../../CLAUDE.md) · ⬇️ [leave-approval](leave-approval/CLAUDE.md) · [expense-approval](expense-approval/CLAUDE.md) · [sick-leave](sick-leave/CLAUDE.md) · [pure-chat](pure-chat/CLAUDE.md) · [faq](faq/CLAUDE.md) · [oncall](oncall/CLAUDE.md)