# 架构图与流程图索引

所有图表使用 Mermaid 语法 (`.mmd`)，可在 GitHub、VS Code (Mermaid 预览插件)、[Mermaid Live Editor](https://mermaid.live) 中直接渲染。

## 图表列表

| 文件 | 类型 | 说明 |
|------|------|------|
| `system-architecture.mmd` | 架构图 | 系统整体架构，五层：UI → Server → Agent → Plugins → Shared |
| `dependency-flow.mmd` | 依赖图 | 三层依赖方向和禁止方向 |
| `chat-flow.mmd` | 时序图 | 聊天请求完整数据流 (用户 → Express → Agent → DeepSeek) |
| `hitl-flow.mmd` | 时序图 | HITL 确认/拒绝流程 (用户 → confirm-state → Tool) |
| `hitl-state-machine.mmd` | 状态图 | HITL 确认状态机 (Idle → Pending → Approved/Rejected) |
| `approval-workflow.mmd` | 流程图 | 远程办公审批完整流程 (含两步 HITL) |
| `plugin-types.mmd` | 对比图 | 审批类/纯聊天/FAQ 三种插件类型对比 |
| `frontend-state-machine.mmd` | 状态图 | 前端 AgentPhase 状态机 |
| `plugin-internal.mmd` | 类图 | BusinessPlugin 接口及关联类型 |
| `validation-flow.mmd` | 流程图 | 表单校验流程 (报销审批示例) |

## 渲染方式

### VS Code
安装 "Mermaid Markdown Syntax Highlighting" 或 "Markdown Preview Mermaid Support" 插件。

### Mermaid Live Editor
访问 https://mermaid.live ，粘贴 `.mmd` 文件内容，可导出 PNG/SVG。

### CLI 导出
```bash
npm install -g @mermaid-js/mermaid-cli
mmdc -i docs/diagrams/system-architecture.mmd -o docs/diagrams/system-architecture.png
```