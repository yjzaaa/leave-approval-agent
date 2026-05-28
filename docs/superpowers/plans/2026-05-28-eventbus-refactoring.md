# EventBus 替代 onSSE 回调链 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用类型安全的 `IAgentEventBus` 接口替代 `onSSE: SSECallback` 在 Express Route → ChatService → startAgent → HitlSession 四层之间的透传耦合

**Architecture:** 新建 `IAgentEventBus` 接口（domain 纯类型）+ `AgentEventBus` 实现（基于 Node EventEmitter），每个 HTTP 请求一个实例。Express 路由创建 bus 并订阅事件写 SSE，各组件通过 `eventBus.emit()` 发布事件。HitlManager 零改动。

**Tech Stack:** TypeScript, Node EventEmitter, Vitest

---

### Task 1: 创建 IAgentEventBus 接口（domain 纯类型）

**Files:**
- Create: `src/models/domain/interfaces/IEventBus.ts`

- [ ] **Step 1: 创建接口文件**

```typescript
/**
 * Agent 会话事件总线接口 — 替代 onSSE 回调链
 *
 * 每个 Agent 会话一个实例，请求级生命周期。
 * Express 路由创建实例并订阅，各组件通过 emit() 发布事件。
 */
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

- [ ] **Step 2: 验证类型检查**

Run: `npx tsc --noEmit`
Expected: 无新增错误（接口文件无运行时依赖，不影响编译）

- [ ] **Step 3: Commit**

```bash
git add src/models/domain/interfaces/IEventBus.ts
git commit -m "feat: 新增 IAgentEventBus 接口 — 类型安全的事件总线定义"
```

---

### Task 2: 创建 AgentEventBus 实现

**Files:**
- Create: `src/agent/events/event-bus.ts`
- Create: `src/agent/events/index.ts`

- [ ] **Step 1: 创建 event-bus.ts 实现**

```typescript
/**
 * AgentEventBus — IAgentEventBus 的 EventEmitter 实现
 *
 * 封装 Node EventEmitter，提供类型安全的 emit/on。
 * 每个 HTTP 请求创建一个新实例，请求结束时 destroy()。
 */
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

- [ ] **Step 2: 创建 index.ts 汇总导出**

```typescript
export { AgentEventBus } from './event-bus.js';
```

- [ ] **Step 3: 验证编译**

Run: `npx tsc --noEmit`
Expected: 无新增错误

- [ ] **Step 4: Commit**

```bash
git add src/agent/events/event-bus.ts src/agent/events/index.ts
git commit -m "feat: 新增 AgentEventBus — 基于 Node EventEmitter 的类型安全实现"
```

---

### Task 3: 编写 EventBus 单元测试

**Files:**
- Create: `tests/event-bus.test.ts`

- [ ] **Step 1: 编写测试**

```typescript
/**
 * AgentEventBus 单元测试
 */
import { describe, it, expect, vi } from 'vitest';
import { AgentEventBus } from '../src/agent/events/event-bus.js';

describe('AgentEventBus', () => {
  it('emit → on 触发 handler', () => {
    const bus = new AgentEventBus();
    const handler = vi.fn();
    bus.on('text', handler);
    bus.emit('text', { content: 'hello' });
    expect(handler).toHaveBeenCalledWith({ content: 'hello' });
  });

  it('多个订阅者独立接收事件', () => {
    const bus = new AgentEventBus();
    const h1 = vi.fn();
    const h2 = vi.fn();
    bus.on('done', h1);
    bus.on('done', h2);
    bus.emit('done', {});
    expect(h1).toHaveBeenCalledTimes(1);
    expect(h2).toHaveBeenCalledTimes(1);
  });

  it('on() 返回取消订阅函数', () => {
    const bus = new AgentEventBus();
    const handler = vi.fn();
    const unsub = bus.on('text', handler);
    unsub();
    bus.emit('text', { content: 'should not fire' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('destroy() 移除所有监听器', () => {
    const bus = new AgentEventBus();
    const handler = vi.fn();
    bus.on('text', handler);
    bus.on('done', handler);
    bus.destroy();
    bus.emit('text', { content: 'x' });
    bus.emit('done', {});
    expect(handler).not.toHaveBeenCalled();
  });

  it('不同事件类型不互相干扰', () => {
    const bus = new AgentEventBus();
    const textHandler = vi.fn();
    const doneHandler = vi.fn();
    bus.on('text', textHandler);
    bus.on('done', doneHandler);
    bus.emit('text', { content: 'hello' });
    expect(textHandler).toHaveBeenCalledTimes(1);
    expect(doneHandler).not.toHaveBeenCalled();
  });

  it('confirm_required 事件携带 form 和 fieldLabels', () => {
    const bus = new AgentEventBus();
    const handler = vi.fn();
    bus.on('confirm_required', handler);
    bus.emit('confirm_required', {
      tool: 'submit',
      label: '确认提交',
      form: { name: '张三', days: '3' },
      fieldLabels: { name: '姓名', days: '天数' },
    });
    expect(handler).toHaveBeenCalledWith({
      tool: 'submit',
      label: '确认提交',
      form: { name: '张三', days: '3' },
      fieldLabels: { name: '姓名', days: '天数' },
    });
  });

  it('done 事件 payload 为空对象', () => {
    const bus = new AgentEventBus();
    const handler = vi.fn();
    bus.on('done', handler);
    bus.emit('done', {});
    expect(handler).toHaveBeenCalledWith({});
  });
});
```

- [ ] **Step 2: 运行测试**

Run: `npx vitest run tests/event-bus.test.ts`
Expected: 7/7 通过

- [ ] **Step 3: Commit**

```bash
git add tests/event-bus.test.ts
git commit -m "test: 新增 AgentEventBus 单元测试 — emit/on/unsub/destroy"
```

---

### Task 4: 改造 HitlSession — onSSE → eventBus

**Files:**
- Modify: `src/agent/hitl/hitl-session.ts`

- [ ] **Step 1: 替换导入和构造函数参数**

```typescript
// 替换 import
import type { IAgentEventBus } from '../../models/domain/interfaces/IEventBus.js';

// 删除
import type { SSECallback } from '../../models/domain/interfaces/ISSE.js';

// 构造函数: onSSE: SSECallback → eventBus: IAgentEventBus
constructor(
  scenario: Scenario,
  eventBus: IAgentEventBus,
  fieldLabels: Record<string, string>,
  tracer?: ITracer,
)
```

- [ ] **Step 2: 替换回调调用为 eventBus.emit**

在 `onEvent` 回调中：

```typescript
case 'confirm_required':
  tracer?.markHitl(event.tool);
  eventBus.emit('confirm_required', {
    tool: event.tool,
    label: event.label ?? '📋 确认操作',
    form: scenario.formatFormForDisplay
      ? scenario.formatFormForDisplay(event.form as Record<string, string>)
      : event.form,
    fieldLabels,
  });
  break;
case 'confirm_resolved':
  eventBus.emit('confirm_resolved', { tool: event.tool });
  break;
```

- [ ] **Step 3: 验证编译 + 运行已有测试**

Run: `npx tsc --noEmit && npx vitest run tests/learnings.test.ts`
Expected: 类型检查通过，31/31 测试通过

- [ ] **Step 4: Commit**

```bash
git add src/agent/hitl/hitl-session.ts
git commit -m "refactor: HitlSession 构造函数 onSSE → eventBus"
```

---

### Task 5: 改造 agent-factory — onSSE → eventBus

**Files:**
- Modify: `src/agent/core/agent-factory.ts`
- Modify: `src/agent/core/types.ts`

- [ ] **Step 1: 更新 types.ts — 替换 import 和 AgentRunParams**

```typescript
// 替换 import
import type { IAgentEventBus } from '../../models/domain/interfaces/IEventBus.js';

// AgentRunParams: onSSE → eventBus
export interface AgentRunParams {
  scenario: Scenario;
  message: string;
  history?: ChatMessage[];
  eventBus: IAgentEventBus;
  memories?: MemoryItem[];
  summary?: string;
  tracer?: ITracer;
  model?: ReturnType<typeof getModel>;
}
```

- [ ] **Step 2: 更新 agent-factory.ts**

```typescript
// 替换 import
import type { IAgentEventBus } from '../../models/domain/interfaces/IEventBus.js';

// 删除
import type { SSECallback } from './types.js';

// startAgent 参数解构
const { scenario, message, history, eventBus, memories, summary, tracer } = params;

// HitlSession 构造
const hitlSession = new HitlSession(scenario, eventBus, getFieldLabels(scenario), tracer);

// agent.subscribe 内替换所有 onSSE(...) → eventBus.emit(...)
case 'tool_execution_end':
  eventBus.emit('tool_result', { tool: event.toolName, error: event.isError });
  if (...) {
    eventBus.emit('content', { blocks: detail.blocks });
  }
  break;
case 'message_update':
  if (ev.type === 'text_delta') {
    eventBus.emit('text', { content: ev.delta });
  }
  break;
case 'agent_end':
  eventBus.emit('done', {});
  break;
```

- [ ] **Step 3: 验证编译**

Run: `npx tsc --noEmit`
Expected: 无类型错误（agent-factory 和 types 的改动应与下游改动同步进行时会报错，这是预期的）

- [ ] **Step 4: Commit**

```bash
git add src/agent/core/agent-factory.ts src/agent/core/types.ts
git commit -m "refactor: agent-factory onSSE → eventBus，AgentRunParams 更新"
```

---

### Task 6: 改造 ChatService + DI 注册 — onSSE → eventBus

**Files:**
- Modify: `src/controllers/services/chat/index.ts`
- Modify: `src/controllers/di.ts`
- Modify: `src/agent/di.ts`

- [ ] **Step 1: 更新 ChatService（chat/index.ts）**

```typescript
// 替换 import
import type { IAgentEventBus } from '../../../models/domain/interfaces/IEventBus.js';

// 删除
import type { SSECallback } from '../../../models/domain/interfaces/ISSE.js';

// ChatRunParams: onSSE → eventBus
export interface ChatRunParams {
  scenario: Scenario;
  message: string;
  history?: ChatMessage[];
  memories?: MemoryItem[];
  summary?: string;
  sessionId: string;
  userId?: string;
  eventBus: IAgentEventBus;
}

// run() 方法中解构和传递
const { scenario, message, history, memories, summary, sessionId, userId, eventBus } = params;

const run = this.startAgent({
  scenario, message, history, memories, summary,
  eventBus,
  tracer,
});
```

- [ ] **Step 2: 更新 controllers/di.ts**

```typescript
// 删除 import SSECallback 行（不再需要）
```

- [ ] **Step 3: 更新 agent/di.ts — HitlSessionFactory**

```typescript
// 替换 import
import type { IAgentEventBus } from '../models/domain/interfaces/IEventBus.js';

// 删除
import type { SSECallback } from '../models/domain/interfaces/ISSE.js';

// HitlSessionFactory 签名
export type HitlSessionFactory = (
  scenario: Scenario,
  eventBus: IAgentEventBus,
  tracer?: ITracer,
) => HitlSession;

// 工厂实现
return (scenario, eventBus, tracer) => {
  const fieldLabels: Record<string, string> = {};
  if (scenario.fields) {
    for (const f of scenario.fields) { fieldLabels[f.key] = f.label; }
  }
  return new HitlSession(scenario, eventBus, fieldLabels, tracer);
};
```

- [ ] **Step 4: 验证编译**

Run: `npx tsc --noEmit`
Expected: 此时应该只剩下 chat route 未改造导致的类型错误（`onSSE` 不存在于 `ChatRunParams`）

- [ ] **Step 5: Commit**

```bash
git add src/controllers/services/chat/index.ts src/controllers/di.ts src/agent/di.ts
git commit -m "refactor: ChatService + DI 注册 onSSE → eventBus"
```

---

### Task 7: 改造 Express chat 路由 — 创建 EventBus + 订阅 → SSE

**Files:**
- Modify: `src/controllers/server/routes/chat.ts`

- [ ] **Step 1: 重写 chat 路由的事件处理逻辑**

```typescript
// 新增 import
import { AgentEventBus } from '../../../agent/events/index.js';

// router.post('/chat', ...) 内：
res.writeHead(200, {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
  'X-Accel-Buffering': 'no',
});

const eventBus = new AgentEventBus();

// 订阅 → SSE 写入
eventBus.on('text', (data) => sendSSE(res, 'text', data));
eventBus.on('tool_result', (data) => sendSSE(res, 'tool_result', data));
eventBus.on('content', (data) => sendSSE(res, 'content', data));
eventBus.on('confirm_required', (data) => sendSSE(res, 'confirm_required', data));
eventBus.on('confirm_resolved', (data) => sendSSE(res, 'confirm_resolved', data));
eventBus.on('done', () => { sendSSE(res, 'done', {}); eventBus.destroy(); });
eventBus.on('error', (data) => { sendSSE(res, 'error', data); eventBus.destroy(); });

try {
  await chatService.run({
    scenario,
    message,
    history,
    memories,
    summary,
    sessionId: resolvedSessionId,
    userId,
    eventBus,
  });
} catch (err: unknown) {
  eventBus.emit('error', { message: err instanceof Error ? err.message : String(err) });
} finally {
  res.end();
}
```

删除 `onSSE: (event, data) => sendSSE(res, event, data)` 透传。

- [ ] **Step 2: 验证编译**

Run: `npx tsc --noEmit`
Expected: 零错误

- [ ] **Step 3: 运行全部测试**

Run: `npx vitest run`
Expected: EventBus 7/7 通过，learnings 31/31 通过，无回归

- [ ] **Step 4: Commit**

```bash
git add src/controllers/server/routes/chat.ts
git commit -m "refactor: Express chat 路由 — EventBus 订阅替代 onSSE 透传"
```

---

### Task 8: 端到端验证 + 清理

**Files:**
- Modify: `src/agent/CLAUDE.md` — 更新时序图中的 onSSE 引用
- Modify: `src/controllers/CLAUDE.md` — 更新时序图中的 onSSE 引用

- [ ] **Step 1: 启动开发服务器做真实测试**

Run: `npx vite --host 0.0.0.0`

在另一个终端验证：

```bash
# 场景列表正常
curl -s http://localhost:5173/api/scenarios | node -e "process.stdin.on('data', d => console.log(JSON.parse(d).scenarios.length + ' scenarios'))"
# Expected: 7 scenarios

# 记忆提取正常
curl -s -X POST http://localhost:5173/api/extract-memories \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"测试"}],"scenario":"finance_query"}' \
  | node -e "process.stdin.on('data', d => { const r = JSON.parse(d); console.log('learnings:', r.learnings ? 'OK' : 'MISSING') })"
# Expected: learnings: OK
```

- [ ] **Step 2: 运行完整测试套件 + 类型检查**

Run: `npx vitest run && npx tsc --noEmit`
Expected: 全部通过，零错误

- [ ] **Step 3: 更新 CLAUDE.md 文档**

将 `src/agent/CLAUDE.md` 和 `src/controllers/CLAUDE.md` 中的时序图 `onSSE(...)` 调用替换为 `eventBus.emit(...)` 模式。

- [ ] **Step 4: 最终 Commit**

```bash
git add src/agent/CLAUDE.md src/controllers/CLAUDE.md
git commit -m "docs: 更新 CLAUDE.md 时序图 — onSSE → eventBus"
```

---

## Self-Review 结果

**1. Spec coverage:**
- ✅ Task 1 → IEventBus.ts 创建
- ✅ Task 2 → AgentEventBus 实现
- ✅ Task 3 → 单元测试
- ✅ Task 4 → HitlSession 改造
- ✅ Task 5 → agent-factory 改造
- ✅ Task 6 → ChatService + DI 改造
- ✅ Task 7 → Express 路由改造
- ✅ Task 8 → 端到端验证 + 文档
- ✅ HitlManager 零改动（设计决策）

**2. Placeholder scan:** 无 TBD/TODO/fill in details/implement later。

**3. Type consistency:**
- ✅ `IAgentEventBus` 在所有文件中统一引用
- ✅ `AgentEventMap` 事件类型在 `emit<K>` 和 `on<K>` 中泛型一致
- ✅ `eventBus` 参数名在所有层统一（不混用 `bus` / `eventBus`）
- ✅ `ChatRunParams.eventBus` → `startAgent({ eventBus })` → `HitlSession(scenario, eventBus, ...)` 链路一致
