# 纯聊天插件 (pure-chat)

> ⬆️ [返回 plugins/](../AGENTS.md) · [项目根目录](../../../AGENTS.md)

## 业务描述

最简单的插件形态：只有 prompt + 空 tools。无表单、无 HITL、纯对话。

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

> ⬆️ [返回 plugins/](../AGENTS.md) · [项目根目录](../../../AGENTS.md)