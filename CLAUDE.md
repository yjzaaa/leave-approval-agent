# 项目规范 — Leave Approval Agent

> **架构详情:** [src/CLAUDE.md](src/CLAUDE.md) — 系统架构图、依赖方向图、记忆系统、时序图

## 核心原则

1. **领域层零依赖** — `domain/` 只定义类型和接口，不 import 任何外部包
2. **框架不知道 tool** — `agent/` 不定义任何 tool，tool 由场景完全自主提供
3. **场景完全自主** — 每个场景自带 prompt + tools + api + validator
4. **HITL 是可选能力** — 框架提供 `hitl/`，场景按需 import
5. **前端零改动** — 新增场景或切换运行模式都不需要修改前端代码
6. **后端可选** — Express 是可选组件，前端可通过 local 模式直接在浏览器中运行 Agent
7. **结构化错误** — 统一 `AppError` 体系，按 `ErrorCode` 分类，前端按 code 处理
8. **Service 编排** — 复杂业务逻辑（对话/记忆/场景发现）集中在 `services/` 层

## 目录职责 (MVC 三层 + 基础设施)

| 目录 | MVC 层 | 职责 | 详细文档 |
|------|--------|------|---------|
| `src/models/` | **Model** | 数据 + 业务逻辑 (domain/scenarios/memory) | [CLAUDE.md](src/models/CLAUDE.md) |
| `src/views/` | **View** | 纯展示 + UI 交互 (components/hooks/i18n/styles) | [CLAUDE.md](src/views/CLAUDE.md) |
| `src/controllers/` | **Controller** | 编排 + 路由 (hooks/server/services) | [CLAUDE.md](src/controllers/CLAUDE.md) |
| `src/agent/` | 基础设施 | Agent 框架（业务无关） | [CLAUDE.md](src/agent/CLAUDE.md) |
| `src/infrastructure/` | 基础设施 | 工具函数/常量/错误体系 | [CLAUDE.md](src/infrastructure/CLAUDE.md) |

## 编码规范

- 所有方法、类、重要步骤必须有中文注释
- 注释规范 (JSDoc 中文):
  - **文件头**: `/** 模块用途说明 */` — 每个 .ts 文件顶部必须有
  - **函数/方法**: `/** 功能描述 @param xxx 参数说明 @returns 返回值说明 */`
  - **类**: `/** 类职责说明 */` + 每个 public 方法单独注释
  - **接口/类型**: `/** 用途说明 */` — 每个字段单独注释
  - **属性/字段**: `/** 描述 */` (JSDoc 单行) — 说明业务含义
  - **行内注释**: `// 简短说明` — 解释非显而易见的逻辑 (Why, 不是 What)
  - **分区注释**: `// ═══...═══` — 长文件中分隔逻辑区块
- 文件编码: UTF-8 (无 BOM)
- 命名: TypeScript camelCase，文件 kebab-case
- 组件: React 函数式组件 + Hooks
- 样式: 墨韵设计系统，CSS Variables token，禁止蓝紫渐变
- 字体: Crimson Pro + Noto Serif SC + IBM Plex Mono + Noto Sans SC
- 主题: 墨韵 (warm paper + ink-dark + vermillion accent)，dark/light/system
- 依赖注入: 通过 `Scenario` 接口，禁止直接 import 具体业务
- **禁止裸 JSON 返回值** — tool / API / 函数返回结构化数据时，必须使用 `interface` 或 `type` 约束，禁止直接返回 `{ success: true, processId, message: '...' }` 等未类型化的对象字面量。所有返回结构必须在 `domain/` 中定义对应类型
- **禁止使用 `any`** — 禁止在类型注解、函数参数、返回值、泛型参数中使用 `any`。必须使用具体类型、泛型或 `unknown`
- **CLAUDE.md 文档规范** — 每个 CLAUDE.md 必须包含以下四项:
  1. **目录结构** — 当前层的文件树 (`tree` 代码块)
  2. **架构图** — 模块关系或组件结构 (`mermaid graph`)
  3. **数据流** — 数据在层内/层间的流转路径 (`mermaid graph` 或表格)
  4. **时序图** — 关键交互流程 (`mermaid sequenceDiagram`)
  - 场景级 CLAUDE.md (scenarios/xxx/) 可简化为审批流程图 + Tool 列表
  - 越底层的文档越精简，越上层的越完整
  - 新增/删除文件后必须同步更新对应 CLAUDE.md

## 行为准则

### 1. 先思考，再编码

- 实现前先明确假设，不确定时主动提问
- 存在多种方案时，列出对比而非默默选择
- 有更简单方案时主动指出，敢于 push back
- 遇到不清楚的地方停下来，说清楚哪里困惑

### 2. 简洁优先

- 只实现需求范围内的功能，不做推测性编码
- 不引入单次使用场景的抽象
- 不添加未被请求的"灵活性"或"可配置性"
- 不为不可能发生的场景添加错误处理
- 200 行能缩到 50 行就重写，问自己"高级工程师会觉得过度设计吗？"

### 3. 手术式修改

- 只改必须改的，不改相邻代码、注释、格式
- 不重构没坏的东西
- 匹配现有风格，即使你有不同偏好
- 发现无关死代码时只提出来，不直接删除
- 只清理你自己的修改造成的孤立引用（import/变量/函数）
- **检验标准**: 每一行改动都应直接追溯到需求

### 4. 目标驱动执行

- 把任务转化为可验证的目标："修复 bug" → "写复现测试，修到通过"
- 多步骤任务先列简要计划: `1. [步骤] → 验证: [检查点]`
- 强验证标准让你能独立迭代，弱标准需要反复确认

这些准则起作用的表现是: diff 中不必要的改动变少、无过度设计导致的返工、实现前提出澄清问题而非实现后出错。

## 运行命令

```bash
npm run dev           # 前端 local 模式 (浏览器直接运行 Agent，无需后端)
npm run dev:server    # Express 服务端
npm run dev:all       # Server 模式 (Express :3000 + Vite :5173 代理)
npm run build         # 生产构建
npm run cli           # CLI 模式
npm run cli -- --scenario=xxx  # 指定场景
```

**运行模式**:

| 命令 | 模式 | `import.meta.env.MODE` | 说明 |
|------|------|------------------------|------|
| `npm run dev` | local | `"development"` | Vite 独立运行，Agent 直接在浏览器中执行 |
| `npm run dev:all` | server | `"server"` | Express + Vite，Vite 代理 `/api` → `:3000` |
| `npm run dev:server` | 仅后端 | — | 只启动 Express，无前端 |

## Git 规范

- 分支: `feature/pi-framework`
- 提交格式: `type: 描述` (feat/fix/refactor/docs/chore)
- 提交描述使用中文

## 端口

- Express: `3000` / Vite dev: `5173`
- Local 模式: 无代理，前端直接调用 Agent
- Server 模式: Vite 代理 `/api` → `:3000` (由 `vite --mode server` 激活)

## Post-Commit: Update CLAUDE.md

After every commit, review the diff and update the corresponding CLAUDE.md file(s) to reflect what changed.

Mapping:
- `src/models/**` → `src/models/CLAUDE.md` + 对应子目录 CLAUDE.md
- `src/views/**` → `src/views/CLAUDE.md`
- `src/controllers/**` → `src/controllers/CLAUDE.md`
- `src/agent/**` → `src/agent/CLAUDE.md`
- `src/infrastructure/**` → `src/infrastructure/CLAUDE.md`
- `src/App.tsx`, `src/main.tsx` → `src/CLAUDE.md`
- Root-level files → root `CLAUDE.md`

What to update:
- Added/removed/renamed files or exports
- New components, hooks, types, or API endpoints
- Changed architecture or data flow
- New dependencies or config changes

Do NOT rewrite the entire file — only update the relevant sections. If nothing meaningful changed (typo fix, style tweak), skip the update.

---

> **架构详情:** [src/CLAUDE.md](src/CLAUDE.md) — 系统架构图、依赖方向图、记忆系统、时序图
