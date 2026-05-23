# 架构图与流程图索引

## Excalidraw 图表 (可视化编辑)

| 文件 | 类型 | 说明 |
|------|------|------|
| `system-architecture.excalidraw` | 架构图 | 系统五层架构 (UI → Server → Agent → Plugins → Shared) |
| `hitl-flow.excalidraw` | 流程图 | HITL 确认流程 (提交/拒绝分支 + 两步确认) |
| `approval-workflow.excalidraw` | 流程图 | 远程办公审批完整流程 (收集→校验→HITL×2→完成) |
| `plugin-structure.excalidraw` | 对比图 | 审批类 / 纯聊天 / FAQ 三种插件类型 |

### 查看方式

1. 访问 https://excalidraw.com
2. 点击左上角菜单 → Open → 选择 `.excalidraw` 文件
3. 或安装 VS Code Excalidraw 插件直接编辑

## Mermaid 图表 (文本可渲染)

| 文件 | 类型 | 说明 |
|------|------|------|
| `system-architecture.mmd` | 架构图 | 系统整体架构 |
| `dependency-flow.mmd` | 依赖图 | 三层依赖方向 |
| `chat-flow.mmd` | 时序图 | 聊天请求数据流 |
| `hitl-flow.mmd` | 时序图 | HITL 确认流程 |
| `hitl-state-machine.mmd` | 状态图 | HITL 状态机 |
| `approval-workflow.mmd` | 流程图 | 审批流程 |
| `plugin-types.mmd` | 对比图 | 三种插件类型 |
| `frontend-state-machine.mmd` | 状态图 | 前端状态机 |
| `plugin-internal.mmd` | 类图 | BusinessPlugin 接口 |
| `validation-flow.mmd` | 流程图 | 表单校验 |

### Mermaid 渲染

- **VS Code**: 安装 Mermaid 预览插件
- **GitHub**: 直接渲染 `.md` 中的 mermaid 代码块
- **在线**: https://mermaid.live
- **CLI**: `mmdc -i xxx.mmd -o xxx.png`