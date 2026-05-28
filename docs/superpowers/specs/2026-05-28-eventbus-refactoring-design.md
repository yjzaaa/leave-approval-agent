# EventBus 替代 onSSE 回调链 — 重构设计

> **目标:** 消除 `onSSE` 回调在 4 层之间的透传耦合，用类型安全的事件总线实现发布/订阅解耦。

**现状问题:**
- `onSSE: SSECallback` 被 Express Route → ChatService → startAgent → HitlSession 逐层透传
- 新增事件类型需改动 5+ 处（ISSE.ts / agent-factory / useAgentCore / handleSSE / AgentEvent）
- 任何中间层想订阅事件（如 MLflow tracer）必须修改回调签名
- 每层都依赖 `SSECallback` 类型，形成不必要的耦合

**架构:** 创建 `IAgentEventBus` 接口（domain 纯类型）+ `AgentEventBus` 实现（agent/events/），每个 HTTP 请求一个实例

**影响范围:** 9 个文件（新增 3、修改 6），HitlManager 零改动

---

## 新增文件

### 1. `src/models/domain/interfaces/IEventBus.ts` — 事件类型 + 接口

```typescript
/** Agent 会话事件映射（类型安全的 emit/on） */
export interface AgentEventMap {
  text:             { content: string };
  tool_result:      { tool: string; error?: string };
  content:          { blocks: Array<{ type: string; data: Record<string, unknown> }> };
  done:             Record<string, never>;
  error:            { message: string };
  confirm_required: { tool: string; label: string; form: Record<string, string>; fieldLabels: Record<string, string> };
  confirm_resolved: { tool: string };
}

/** 类型安全的事件总线接口 — 每个 Agent 会话一个实例 */
export interface IAgentEventBus {
  /** 发布事件 */
  emit<K extends keyof AgentEventMap>(event: K, data: AgentEventMap[K]): void;
  /** 订阅事件，返回取消订阅函数 */
  on<K extends keyof AgentEventMap>(event: K, handler: (data: AgentEventMap[K]) => void): () => void;
  /** 销毁总线，移除所有监听器 */
  destroy(): void;
}
```

### 2. `src/agent/events/event-bus.ts` — 实现（基于 Node EventEmitter）

```typescript
import { EventEmitter } from 'node:events';
import type { IAgentEventBus, AgentEventMap } from '../../models/domain/interfaces/IEventBus.js';

export class AgentEventBus implements IAgentEventBus {
  private emitter = new EventEmitter();

  emit<K extends keyof AgentEventMap>(event: K, data: AgentEventMap[K]): void {
    this.emitter.emit(event as string, data);
  }

  on<K extends keyof AgentEventMap>(event: K, handler: (data: AgentEventMap[K]) => void): () => void {
    this.emitter.on(event as string, handler);
    return () => { this.emitter.off(event as string, handler); };
  }

  destroy(): void {
    this.emitter.removeAllListeners();
  }
}
```

### 3. `src/agent/events/index.ts` — 汇总导出

```typescript
export { AgentEventBus } from './event-bus.js';
```

---

## 修改文件

### 4. `src/agent/core/types.ts` — AgentRunParams 类型更新

```diff
- import type { SSECallback } from '../../models/domain/interfaces/ISSE.js';
+ import type { IAgentEventBus } from '../../models/domain/interfaces/IEventBus.js';

- export type { SSECallback } from '../../models/domain/interfaces/ISSE.js';
+ // SSECallback 保留 re-export 向后兼容（逐步废弃）
+ export type { SSECallback } from '../../models/domain/interfaces/ISSE.js';
```

### 5. `src/agent/core/agent-factory.ts` — 核心改造

```diff
- import type { SSECallback } from './types.js';
+ import type { IAgentEventBus } from '../../models/domain/interfaces/IEventBus.js';

  export interface AgentRunParams {
    scenario: Scenario;
    message: string;
    history?: ChatMessage[];
-   onSSE: SSECallback;
+   eventBus: IAgentEventBus;
    memories?: MemoryItem[];
    summary?: string;
    tracer?: ITracer;
    model?: ReturnType<typeof getModel>;
  }

  export function startAgent(params: AgentRunParams): AgentRun {
-   const { scenario, message, history, onSSE, memories, summary, tracer } = params;
+   const { scenario, message, history, eventBus, memories, summary, tracer } = params;

    // HitlSession 构造函数同样替换 onSSE → eventBus
-   const hitlSession = new HitlSession(scenario, onSSE, getFieldLabels(scenario), tracer);
+   const hitlSession = new HitlSession(scenario, eventBus, getFieldLabels(scenario), tracer);

    agent.subscribe(async (event, _signal) => {
      tracer?.handleEvent(event);
      switch (event.type) {
        case 'tool_execution_end':
-         onSSE('tool_result', { tool: event.toolName, error: event.isError });
+         eventBus.emit('tool_result', { tool: event.toolName, error: event.isError });
          if (...) {
-           onSSE('content', { blocks: detail.blocks });
+           eventBus.emit('content', { blocks: detail.blocks as AgentEventMap['content']['blocks'] });
          }
          break;
        case 'message_update':
          if (ev.type === 'text_delta') {
-           onSSE('text', { content: ev.delta });
+           eventBus.emit('text', { content: ev.delta });
          }
          break;
        case 'agent_end':
-         onSSE('done', {});
+         eventBus.emit('done', {});
          break;
      }
    });
  }
```

### 6. `src/agent/hitl/hitl-session.ts` — HITL 事件桥接

```diff
- import type { SSECallback } from '../../models/domain/interfaces/ISSE.js';
+ import type { IAgentEventBus } from '../../models/domain/interfaces/IEventBus.js';

  export class HitlSession {
    constructor(
      scenario: Scenario,
-     onSSE: SSECallback,
+     eventBus: IAgentEventBus,
      fieldLabels: Record<string, string>,
      tracer?: ITracer,
    ) {
      this.hitl = new HitlManager({
        onEvent: (event) => {
          switch (event.type) {
            case 'confirm_required':
              tracer?.markHitl(event.tool);
-             onSSE('confirm_required', { ... });
+             eventBus.emit('confirm_required', {
+               tool: event.tool,
+               label: event.label ?? '📋 确认操作',
+               form: scenario.formatFormForDisplay
+                 ? scenario.formatFormForDisplay(event.form as Record<string, string>)
+                 : event.form,
+               fieldLabels,
+             });
              break;
            case 'confirm_resolved':
-             onSSE('confirm_resolved', { tool: event.tool });
+             eventBus.emit('confirm_resolved', { tool: event.tool });
              break;
          }
        },
      });
    }
  }
```

**HitlManager 零改动** — 仍通过 `onEvent` 回调内聚通知 HitlSession，HitlSession 桥接到 EventBus。

### 7. `src/controllers/services/chat/index.ts` — 透传替换

```diff
- import type { SSECallback } from '../../../models/domain/interfaces/ISSE.js';
+ import type { IAgentEventBus } from '../../../models/domain/interfaces/IEventBus.js';

  export interface ChatRunParams {
    ...
-   onSSE: SSECallback;
+   eventBus: IAgentEventBus;
  }

  async run(params: ChatRunParams): Promise<void> {
-   const { scenario, message, history, memories, summary, sessionId, userId, onSSE } = params;
+   const { scenario, message, history, memories, summary, sessionId, userId, eventBus } = params;

    const run = this.startAgent({
      scenario, message, history, memories, summary,
-     onSSE,
+     eventBus,
      tracer,
    });
  }
```

### 8. `src/controllers/di.ts` — 类型更新

```diff
- import type { SSECallback } from '../models/domain/interfaces/ISSE.js';
+ // SSECallback 不再需要，ChatRunParams.onSSE → eventBus
```

### 9. `src/agent/di.ts` — HitlSessionFactory 类型更新

```diff
- import type { SSECallback } from '../models/domain/interfaces/ISSE.js';
+ import type { IAgentEventBus } from '../models/domain/interfaces/IEventBus.js';

  export type HitlSessionFactory = (
    scenario: Scenario,
-   onSSE: SSECallback,
+   eventBus: IAgentEventBus,
    tracer?: ITracer,
  ) => HitlSession;

  // 工厂实现同样更新
  ctx.singleton<HitlSessionFactory>('hitlFactory', () => {
-   return (scenario, onSSE, tracer) => {
+   return (scenario, eventBus, tracer) => {
      ...
-     return new HitlSession(scenario, onSSE, fieldLabels, tracer);
+     return new HitlSession(scenario, eventBus, fieldLabels, tracer);
    };
  });
```

### 10. `src/controllers/server/routes/chat.ts` — Express 路由变为订阅者

```diff
+ import { AgentEventBus } from '../../../agent/events/index.js';

  router.post('/chat', async (req, res) => {
    ...
    res.writeHead(200, { 'Content-Type': 'text/event-stream', ... });

+   const eventBus = new AgentEventBus();
+
+   // 订阅 → SSE 写入
+   eventBus.on('text', (data) => sendSSE(res, 'text', data));
+   eventBus.on('tool_result', (data) => sendSSE(res, 'tool_result', data));
+   eventBus.on('content', (data) => sendSSE(res, 'content', data));
+   eventBus.on('confirm_required', (data) => sendSSE(res, 'confirm_required', data));
+   eventBus.on('confirm_resolved', (data) => sendSSE(res, 'confirm_resolved', data));
+   eventBus.on('done', () => { sendSSE(res, 'done', {}); eventBus.destroy(); });
+   eventBus.on('error', (data) => { sendSSE(res, 'error', data); eventBus.destroy(); });

    try {
      await chatService.run({
-       ...params,
-       onSSE: (event, data) => sendSSE(res, event, data),
+       ...params,
+       eventBus,
      });
    } catch (err) {
-     sendSSE(res, 'error', { message: ... });
+     eventBus.emit('error', { message: ... });
    } finally {
      res.end();
    }
  });
```

---

## 对比

| 维度 | 改造前 | 改造后 |
|------|--------|--------|
| 耦合方式 | 回调函数逐层透传 | 事件总线注入，按需订阅 |
| 新增订阅者 | 修改所有中间层签名 | `bus.on('event', handler)` 一行 |
| 类型安全 | `(event: string, data: Record<string, unknown>)` — 不校验 payload | `emit('text', { content })` — 编译期校验 |
| 测试 | 需要构造完整的 HTTP response mock | mock `IEventBus` 接口，验证 `emit` 调用 |
| HitlManager | 通过 `onEvent` 回调通知 | **不变** — HitlSession 桥接 |
| 会话隔离 | `onSSE` 闭包天然隔离 | 每个请求一个 `AgentEventBus` 实例 |

## EventBus 不放入 DI 容器

EventBus 是请求级实例（per-request），DI 容器是应用级单例。在 Express 路由中 `new AgentEventBus()` 创建，随请求结束销毁。DI 容器管理的 `ChatService`、`startAgent` 等应用级服务通过参数接收 EventBus。

---

## 事件发布者一览

| 事件 | 发布者 | 触发时机 |
|------|--------|---------|
| `text` | agent-factory | Pi Agent text_delta |
| `tool_result` | agent-factory | Pi Agent tool_execution_end |
| `content` | agent-factory | tool 结果含 ContentBlock |
| `done` | agent-factory | Pi Agent agent_end |
| `error` | chat route | try/catch 异常 |
| `confirm_required` | HitlSession → HitlManager | tool 触发 HITL |
| `confirm_resolved` | HitlSession → HitlManager | 用户确认/拒绝/超时 |
