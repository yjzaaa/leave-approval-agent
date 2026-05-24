# 纯聊天插件 (pure-chat)

> ⬆️ [返回 plugins/](../CLAUDE.md) · [项目根目录](../../../CLAUDE.md)

## 业务描述

最简单的插件形态：只有 prompt + 空 tools。无表单、无 HITL、纯对话。

## 目录结构

```
pure-chat/
└── index.ts       # BusinessPlugin 实例，只有 prompt + 空 tools
```

## 架构图

```mermaid
graph LR
    User["👤 用户"] --> Agent["Pi Agent"]
    Agent -->|"tools: []"| Chat["纯对话<br/>无 Tool 调用"]
    Chat --> Agent
    Agent --> User

    style User fill:#dbe4ff,stroke:#495057
    style Chat fill:#f3f0ff,stroke:#495057
```

## 数据流

```mermaid
graph LR
    User["👤 用户消息"] --> Agent["Pi Agent"]
    Agent -->|"systemPrompt"| LLM["DeepSeek API"]
    LLM -->|"text_delta"| Agent
    Agent -->|"SSE: text"| Browser["Browser"]
    Browser --> User

    style Browser fill:#dbe4ff,stroke:#495057
```

## 插件类型对比

```
tools: []           → 无任何 tool
confirmTools: 无    → 无 HITL
fields: 无          → 无表单
```

## 文件说明

| 文件 | 职责 |
|------|------|
| `index.ts` | BusinessPlugin 实例，只有 prompt + 空 tools |

---

> ⬆️ [返回 plugins/](../CLAUDE.md) · [项目根目录](../../../CLAUDE.md)