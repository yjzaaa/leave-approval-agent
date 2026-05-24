# MLflow Tracing REST API 协议文档

> 本协议基于 `@mlflow/core` TypeScript SDK 源码和 MLflow REST API 规范逆向得出。
> 用于浏览器端直接 `fetch()` 上报 trace 数据到 MLflow Tracking Server。

---

## 架构概览

```
Browser                MLflow Tracking Server (e.g. http://localhost:5000)
   │                              │
   ├─ POST /api/3.0/mlflow/traces ─┤  第1步: 创建 Trace 元数据
   │     ← {trace_info: {...}}     │         返回含 artifactLocation 的 trace_info
   │                              │
   ├─ PUT /api/2.0/mlflow-artifacts/artifacts/{path}/traces.json ─┤  第2步: 上传 Span 数据
   │                              │
```

两步必须按顺序执行。第1步的响应包含第2步所需的 artifact URI。

---

## 第1步: 创建 Trace 元数据 (StartTraceV3)

### 请求

```
POST {host}/api/3.0/mlflow/traces
Content-Type: application/json
```

### 请求体 JSON Schema

```jsonc
{
  "trace": {
    "trace_info": {
      // ── 必填字段 ──
      "trace_id": "tr-<32-hex-chars>",
      // 格式: "tr-" 前缀 + 32 位十六进制字符串
      // 生成: "tr-" + crypto.randomUUID().replace(/-/g, "")

      "trace_location": {
        "type": "MLFLOW_EXPERIMENT",
        // 可选值: "MLFLOW_EXPERIMENT" | "INFERENCE_TABLE" | "TRACE_LOCATION_TYPE_UNSPECIFIED"
        "mlflow_experiment": {
          "experiment_id": "0"
          // 默认实验 ID 为 "0"，可通过 MLFLOW_EXPERIMENT_ID 环境变量指定
        }
        // 注: 若 type 为 INFERENCE_TABLE，则用 inference_table: { full_table_name: "..." }
      },

      "request_time": "2024-05-24T00:00:00.000Z",
      // 类型: string (ISO 8601 格式)
      // 即 root span 的 start_time
      // 转换: new Date(Number(startTimeMs)).toISOString()

      "execution_duration": "1.234s",
      // 类型: string (带 "s" 后缀的秒数)
      // 等于 (root span 的 end_time - start_time) / 1000 + "s"

      "state": "OK",
      // 可选值: "OK" | "ERROR" | "IN_PROGRESS" | "STATE_UNSPECIFIED"
      // 正常完成 = "OK"，有异常 = "ERROR"

      "trace_metadata": {
        "mlflow.trace_schema.version": "3"
        // 必填: schema 版本号为 "3"
        // 可选补充:
        //   "mlflow.trace.tokenUsage": "{\"input_tokens\":100,\"output_tokens\":200,\"total_tokens\":300}"
        //   "mlflow.source.name": "leave-approval-agent"
      },

      // ── 可选字段 ──
      "client_request_id": "optional-client-defined-id",
      // 用于关联外部系统的请求 ID

      "request_preview": "用户消息的前100字符...",
      // 类型: string (最长1000字符，UI 列表页显示)

      "response_preview": "AI 回复的前100字符...",
      // 类型: string (最长1000字符，UI 列表页显示)

      "tags": {
        // key-value 标签 (均可变，创建后可修改)
        // 无 schema_version 限制，任意 string → string 均可
      },

      "assessments": []
      // 评估数组，通常为空
    }
  }
}
```

### 响应体 JSON Schema

```jsonc
{
  "trace": {
    "trace_info": {
      // 与请求体完全相同的结构 +
      // 后端自动填充的字段:
      "tags": {
        "mlflow.artifactLocation": "mlflow-artifacts:/0/traces/tr-<id>/artifacts"
        // ⚠️ 关键: 用于第2步构造上传 URL
      }
      // + 后端可能补充其他字段
    }
  }
}
```

### 鉴权

开源 MLflow (OSS): 无需鉴权，headers 为空对象。

Databricks 托管: 需要 `Authorization: Bearer <token>` header。

---

## 第2步: 上传 Trace 数据 (Artifact Upload)

### URL 构造

从第1步响应中取 `tags["mlflow.artifactLocation"]`，其值为形如:

```
mlflow-artifacts:/0/traces/tr-abc123def456/artifacts
```

**解析规则:**
1. 去掉协议 `mlflow-artifacts:` → 得到 path `/0/traces/tr-abc123def456/artifacts`
2. 拼接: `{host}/api/2.0/mlflow-artifacts/artifacts{path}/traces.json`

**最终 URL 示例:**
```
http://localhost:5000/api/2.0/mlflow-artifacts/artifacts/0/traces/tr-abc123def456/artifacts/traces.json
```

### 请求

```
PUT {resolved-url}
Content-Type: application/json
```

### 请求体 JSON Schema (TraceData)

```jsonc
{
  "spans": [
    {
      // ── 必填字段 ──
      "trace_id": "<base64-16bytes>",
      // ⚠️ 注意: 这是 base64 编码的 16 字节 trace ID，不带 "tr-" 前缀
      // 编码方式: hex → bytes → base64
      // 例: trace_id = "tr-a1b2c3d4e5f6..." → 去掉 "tr-" → hex → 16 bytes → base64
      //
      // ⚠️ SDK 已知缺陷: @mlflow/core 的 encodeTraceIdToBase64 不会剥离 "tr-" 前缀，
      // 导致 trace_id 前 2 字节被错误编码（"tr" + "-a" 被当作 hex 解析 → NaN → 0）。
      // 本协议文档的实现剥离 "tr-"，是正确的做法。

      "span_id": "<base64-8bytes>",
      // base64 编码的 8 字节 span ID
      // 编码方式: 16 位 hex → 8 bytes → base64

      "parent_span_id": "<base64-8bytes>",
      // 父 span 的 base64 span ID，根 span 为空字符串 ""

      "name": "chat:leave_approval",
      // 类型: string，span 名称

      "start_time_unix_nano": "1716566400000000000",
      // 类型: string (JSON number 对 BigInt 不安全，用 string 传输)
      // Unix 纳秒时间戳
      // 转换: Date.now() * 1_000_000 = 纳秒近似值

      "end_time_unix_nano": "1716566401234000000",
      // 同上，span 结束时间

      "status": {
        "code": "STATUS_CODE_OK",
        // 可选值: "STATUS_CODE_OK" | "STATUS_CODE_ERROR" | "STATUS_CODE_UNSET"
        "message": ""
        // 类型: string，错误时的描述信息
      },

      "attributes": {
        // OpenTelemetry attribute 风格的 key-value
        // ⚠️ 属性值直接存储原始值（字符串/数字），不要 JSON.stringify 双重编码
        // spans JSON 整体序列化时框架会处理类型

        "mlflow.traceRequestId": "tr-a1b2c3d4...",
        // ⚠️ 直接存 trace_id 字符串，不需要 JSON.stringify

        "mlflow.spanType": "CHAIN",
        // 直接存 span type，不需要 JSON.stringify
        // 可选 SpanType:
        //   "CHAIN" | "TOOL" | "LLM" | "AGENT" | "CHAT_MODEL"
        //   | "RETRIEVER" | "PARSER" | "EMBEDDING" | "RERANKER"
        //   | "MEMORY" | "UNKNOWN"

        "mlflow.spanInputs": "{\"message\":\"用户输入\"}",
        // 序列化后的 inputs JSON 字符串（框架负责 JSON.stringify）

        "mlflow.spanOutputs": "{\"ok\":true}",
        // 序列化后的 outputs JSON 字符串

        "mlflow.experimentId": "0",
        // 实验 ID，直接存字符串

        // ── 自定义 attributes ──
        "plugin": "leave_approval",
        "userId": "user-123",
        "sessionId": "session-456",
        "messageLength": 42,
        "tool.name": "submit_leave",
        "tool.args": "{\"name\":\"张三\"}",
        "tool.duration_ms": 1234
      },

      "events": []
      // 类型: array，span 事件列表，通常为空
      // 如需记录异常: [{ name: "exception", time_unix_nano: "...", attributes: {...} }]
    }
    // ... 更多 spans
  ]
}
```

### Span 层级关系

```
root span (parent_span_id = "")
  ├── child span 1 (parent_span_id = root.span_id)
  ├── child span 2 (parent_span_id = root.span_id)
  │     └── grandchild (parent_span_id = child2.span_id)
  └── ...
```

每个 span 的 `trace_id` 字段相同（都是 base64 编码的同一个 trace ID）。

---

## SpanType 枚举

| 值 | 说明 | 使用场景 |
|---|------|---------|
| `CHAIN` | 工作流/管道 | 根 span，如 `chat:plugin-name` |
| `TOOL` | 工具调用 | 每个 tool 执行 |
| `LLM` | 大语言模型 | LLM 推理调用 |
| `AGENT` | 智能体 | Agent 决策循环 |
| `CHAT_MODEL` | 聊天模型 | Chat completion 调用 |
| `RETRIEVER` | 检索器 | RAG 检索步骤 |
| `PARSER` | 解析器 | 输出解析 |
| `EMBEDDING` | 嵌入 | Embedding 调用 |
| `RERANKER` | 重排序 | 搜索结果重排 |
| `MEMORY` | 记忆 | 记忆读写 |
| `UNKNOWN` | 未知 | 默认值 |

---

## TraceState 枚举

| 值 | 说明 |
|---|------|
| `OK` | 成功完成 |
| `ERROR` | 执行出错 |
| `IN_PROGRESS` | 进行中（用于流式执行中） |
| `STATE_UNSPECIFIED` | 未指定 |

---

## 错误响应格式

```json
{
  "error_code": "INVALID_PARAMETER_VALUE",
  "message": "描述错误原因"
}
```

HTTP 状态码:
- `200`: 成功
- `400`: 参数错误
- `404`: trace 不存在
- `500`: 服务器内部错误

---

## 浏览器端实现注意事项

### BigInt 序列化

`JSON.stringify` 不支持 `BigInt`。在浏览器端需自行处理:

```ts
function bigIntReplacer(_key: string, value: any): any {
  if (typeof value === 'bigint') return value.toString();
  return value;
}
```

### Base64 编码 Span IDs

```ts
// hex → base64 (浏览器兼容实现)
function hexToBase64(hex: string, expectedBytes: number): string {
  const bytes = new Uint8Array(expectedBytes);
  const padded = hex.padStart(expectedBytes * 2, '0');
  for (let i = 0; i < expectedBytes; i++) {
    bytes[i] = parseInt(padded.substring(i * 2, i * 2 + 2), 16);
  }
  // btoa 只支持 latin1，需逐字节转换
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
```

### ID 生成

```ts
function generateHexId(length: number): string {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

const traceId = 'tr-' + generateHexId(16);  // "tr-" + 32 hex chars
const spanId = generateHexId(8);             // 16 hex chars
```

---

## 完整调用示例

```ts
const HOST = 'http://localhost:5000';
const EXPERIMENT_ID = '0';

// ── 准备数据 ──
const traceId = 'tr-' + generateHexId(16);
const rootSpanId = generateHexId(8);
const toolSpanId = generateHexId(8);
const startTime = Date.now();
const endTime = startTime + 1234;

// BigInt 序列化辅助
function bigIntReplacer(_key: string, value: any): any {
  if (typeof value === 'bigint') return value.toString();
  return value;
}

const spans = [
  {
    trace_id: hexToBase64(traceId.slice(3), 16), // 去掉 "tr-" 前缀
    span_id: hexToBase64(rootSpanId, 8),
    parent_span_id: '',
    name: 'chat:leave_approval',
    start_time_unix_nano: String(BigInt(startTime) * 1_000_000n),
    end_time_unix_nano: String(BigInt(endTime) * 1_000_000n),
    status: { code: 'STATUS_CODE_OK', message: '' },
    attributes: {
      'mlflow.traceRequestId': traceId,                // 直接存字符串，不 JSON.stringify
      'mlflow.spanType': 'CHAIN',                       // 直接存字符串
      'mlflow.spanInputs': JSON.stringify({ message: '用户输入' }),
      'mlflow.spanOutputs': JSON.stringify({ reply: 'AI回复' }),
      'mlflow.experimentId': EXPERIMENT_ID,
    },
    events: [],
  },
  {
    trace_id: hexToBase64(traceId.slice(3), 16),
    span_id: hexToBase64(toolSpanId, 8),
    parent_span_id: hexToBase64(rootSpanId, 8),
    name: 'tool:submit_leave',
    start_time_unix_nano: String(BigInt(startTime + 100) * 1_000_000n),
    end_time_unix_nano: String(BigInt(startTime + 800) * 1_000_000n),
    status: { code: 'STATUS_CODE_OK', message: '' },
    attributes: {
      'mlflow.traceRequestId': traceId,
      'mlflow.spanType': 'TOOL',
      'mlflow.spanInputs': JSON.stringify({ name: '张三', startDate: '2025-01-10' }),
      'mlflow.spanOutputs': JSON.stringify({ ok: true }),
      'mlflow.experimentId': EXPERIMENT_ID,
      'tool.name': 'submit_leave',
      'tool.duration_ms': 700,
    },
    events: [],
  },
];

// ── 第1步: POST /api/3.0/mlflow/traces ──
const traceInfoPayload = {
  trace: {
    trace_info: {
      trace_id: traceId,
      trace_location: {
        type: 'MLFLOW_EXPERIMENT',
        mlflow_experiment: { experiment_id: EXPERIMENT_ID },
      },
      request_time: new Date(startTime).toISOString(),         // ISO 8601
      execution_duration: `${(endTime - startTime) / 1000}s`,  // "1.234s"
      state: 'OK',
      trace_metadata: {
        'mlflow.trace_schema.version': '3',
      },
      request_preview: '用户输入'.slice(0, 100),
      response_preview: 'AI回复'.slice(0, 100),
      tags: {},
      assessments: [],
    },
  },
};

const res1 = await fetch(`${HOST}/api/3.0/mlflow/traces`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(traceInfoPayload),
});
const created = await res1.json();

// ── 第2步: PUT .../traces.json ──
const artifactUri = created.trace.trace_info.tags['mlflow.artifactLocation'];
// artifactUri = "mlflow-artifacts:/0/traces/tr-xxx/artifacts"
const url = new URL(artifactUri);
const artifactPath = url.pathname; // "/0/traces/tr-xxx/artifacts"
const uploadUrl = `${HOST}/api/2.0/mlflow-artifacts/artifacts${artifactPath}/traces.json`;

await fetch(uploadUrl, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ spans }, bigIntReplacer),
});

console.log(`Trace uploaded: ${HOST}/#/traces/${traceId}`);
```
