# MLflow Tracing 集成设计

> 日期: 2026-05-24
> 状态: 已确认
> 方案: MLflow REST API 直接调用，零 SDK 依赖

## 背景

项目基于 Pi Agent Framework，当前无任何可观测性能力。需要全链路追踪监控 LLM 调用、Tool 执行、HITL 确认等关键环节，用于开发调试和性能分析。

## 核心约束

| 约束 | 说明 |
|------|------|
| 最小侵入 | 新增 1 文件，修改 2 文件，每处改动 < 15 行 |
| 零依赖 | 不引入新 npm 包，只用 Node.js 内置 fetch |
| 优雅降级 | 无 MLFLOW_TRACKING_URI 环境变量时自动 no-op |
| 纯后端 | 前端和插件层零改动 |

## Trace 数据模型

```
Trace (一次 /api/chat 请求)
├── Span: chat_request          — Express 路由处理
│   ├── Span: agent_run         — runAgent 执行
│   │   ├── Span: llm_call      — DeepSeek API 调用
│   │   ├── Span: tool_exec     — Tool 执行
│   │   └── Span: hitl_wait     — HITL 确认等待
```

每个 Span 记录：name, start_time, end_time, status, attributes, events。

## 文件变更

### 新增

| 文件 | 职责 |
|------|------|
| `src/agent/mlflow-tracer.ts` | Trace/Span 构造、REST API 调用、降级逻辑 |

核心接口：

```ts
function startTrace(metadata: { plugin: string; userId?: string }): TraceContext
function startSpan(ctx: TraceContext, name: string, parent?: Span): Span
function endSpan(span: Span, attrs?: Record<string, unknown>): void
function endTrace(ctx: TraceContext): void
```

### 修改

| 文件 | 改动 |
|------|------|
| `src/agent/agent-factory.ts` | runAgent 中 ~10 行打点调用 |
| `src/server/index.ts` | /api/chat 路由中 ~5 行打点调用 |

### 不改动

- `src/client/` — 零改动
- `src/plugins/` — 零改动
- `src/shared/` — 零改动

## MLflow 部署

本地开发环境，SQLite 存储：

```bash
pip install mlflow && mlflow server --host 0.0.0.0 --port 5000
MLFLOW_TRACKING_URI=http://localhost:5000 npm run dev:all
```

## 容错策略

- MLflow 不可用 → 静默丢弃，console.warn，不影响主流程
- REST 调用 2s 超时
- tracer 内部不抛异常
- 无 MLFLOW_TRACKING_URI → 完全 no-op，零开销
