# FAQ 政策咨询插件 (faq)

> ⬆️ [返回 plugins/](../AGENTS.md) · [项目根目录](../../../AGENTS.md)

## 业务描述

咨询类插件：只有检索 tool，无 HITL。查询结果直接返回。

## Tool 列表

| Tool | HITL | 说明 |
|------|------|------|
| `search_knowledge_base` | ❌ | 检索知识库 |

## 知识库内容

远程办公政策、年假规定、报销流程、病假申请、加班制度、考勤制度、试用期、离职流程

## 文件说明

| 文件 | 职责 |
|------|------|
| `index.ts` | BusinessPlugin 实例 |
| `tools.ts` | search_knowledge_base tool + 模拟数据 |

---

> ⬆️ [返回 plugins/](../AGENTS.md) · [项目根目录](../../../AGENTS.md)