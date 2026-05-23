# 远程办公申请自动化审批 Agent — 技术设计文档

> 版本: v1.1.0 | 日期: 2026-05-23 | 状态: 已验证

---

## 目录

1. [项目概述](#1-项目概述)
2. [需求规格说明 (SRS)](#2-需求规格说明-srs)
3. [系统架构设计](#3-系统架构设计)
4. [模块详细设计](#4-模块详细设计)
5. [数据模型设计](#5-数据模型设计)
6. [接口规范 (API Spec)](#6-接口规范-api-spec)
7. [状态机与工作流设计](#7-状态机与工作流设计)
8. [Tool 设计](#8-tool-设计)
9. [技术选型与依赖](#9-技术选型与依赖)
10. [项目结构](#10-项目结构)
11. [部署与运行](#11-部署与运行)
12. [测试策略](#12-测试策略)
13. [扩展性设计](#13-扩展性设计)
14. [变更记录](#14-变更记录)

---

## 1. 项目概述

### 1.1 背景

企业远程办公申请流程涉及表单填写、信息校验、审批提交等多个环节。通过 AI Agent 自动化管理，实现：

- 用户自然语言输入 → LLM 自动解析并填写结构化表单
- Agent 自动校验 → 不通过则反馈 LLM 修正，循环直到通过
- **两次用户确认**：确认申请表单 → 提交获取 ID → 确认流程表单 → 发起审批
- Agent 通过 Tool 获取实时信息（当前日期等），避免静态硬编码

### 1.2 目标

| 目标 | 描述 |
|------|------|
| 自动填表 | LLM 根据用户自然语言描述自动填充结构化表单 |
| 智能校验 | Agent 对表单进行多维度业务规则校验 |
| 自动修正 | 校验不通过时，错误信息反馈给 LLM 自动修正，形成闭环 |
| 两次确认 | 第一次确认申请表单内容，第二次确认含 formId 的流程表单 |
| 流程发起 | 两次确认后自动调用流程接口完成审批发起 |
| Tool 支持 | LLM 可通过 Tool 获取实时数据（日期等），提高填表准确性 |
| 单体轻量 | 单进程 TypeScript 应用，零外部服务依赖 |

### 1.3 核心流程

```
用户输入 → LLM 填表(可调用 Tool) → 校验
                                        │
                            ┌───────────┴───────────┐
                            │ 失败                   │ 通过
                            ▼                        ▼
                     LLM 修正(带错误)         第一次用户确认
                            │                        │
                     校验(循环)              ┌───────┴───────┐
                            │               │ 确认          │ 取消
                     超过重试次数 → 失败      ▼               ▼
                                        提交表单       返回
                                        获取 formId
                                             │
                                    第二次用户确认
                                    (含 formId 的流程表单)
                                     │         │
                                  确认        取消
                                   ▼           ▼
                              发起流程     返回(已提交)
                                   │
                              返回结果
```

---

## 2. 需求规格说明 (SRS)

### 2.1 功能需求

| ID | 需求名称 | 优先级 | 描述 |
|----|---------|--------|------|
| FR-01 | 自然语言输入 | P0 | 用户以自然语言描述远程办公需求 |
| FR-02 | 自动填表 | P0 | LLM 解析用户意图，自动填充结构化表单所有字段 |
| FR-03 | Tool 调用 | P0 | LLM 可调用 `get_current_date` 工具获取当前日期 |
| FR-04 | 多维度校验 | P0 | Agent 对表单执行必填、格式、逻辑、业务规则校验 |
| FR-05 | 自动修正循环 | P0 | 校验失败时将错误反馈给 LLM，LLM 重新生成表单 |
| FR-06 | 第一次用户确认 | P0 | 校验通过的表单展示给用户，等待确认 |
| FR-07 | 表单提交 | P0 | 用户确认后调用表单提交 API，获取表单 ID |
| FR-08 | 第二次用户确认 | P0 | 包含 formId 的完整流程表单展示给用户，等待确认 |
| FR-09 | 流程发起 | P0 | 用户确认后调用流程发起 API |
| FR-10 | 结果反馈 | P0 | 向用户返回流程发起的成功/失败信息 |
| FR-11 | 最大重试控制 | P1 | 表单自动修正最多重试 N 次，超出则终止 |
| FR-12 | 通用 LLM Provider | P1 | 支持通过配置切换 Anthropic/OpenAI 协议的多个厂商 |

### 2.2 非功能需求

| ID | 需求 | 指标 |
|----|------|------|
| NFR-01 | 响应时间 | 单次 LLM 调用 < 10s，完整流程 < 60s |
| NFR-02 | 可靠性 | 表单提交和流程发起支持重试机制 |
| NFR-03 | 可维护性 | 模块化设计，表单模板和校验规则可配置 |
| NFR-04 | 可扩展性 | 支持替换为真实 API，支持接入 IM 渠道 |
| NFR-05 | 安全性 | API Key 通过 `.env` 文件配置，不硬编码 |

### 2.3 核心用例描述

**UC-01: 提交远程办公申请**

| 项目 | 内容 |
|------|------|
| 参与者 | 用户 |
| 前置条件 | `.env` 中已配置有效的 `LLM_API_KEY` |
| 主流程 | 1. 用户输入自然语言描述<br>2. Agent 调用 LLM（可调用 Tool 获取日期）解析并生成表单<br>3. Agent 校验表单<br>4. 若校验失败，将错误反馈给 LLM 重新生成（回到3，最多N次）<br>5. 校验通过，展示表单给用户 → **第一次确认**<br>6. 用户确认 → 提交表单获取 formId<br>7. 展示含 formId 的流程表单 → **第二次确认**<br>8. 用户确认 → 发起流程 |
| 后置条件 | 表单已提交，审批流程已发起 |
| 异常流程 | a. 超过最大重试次数 → 提示用户重新描述<br>b. 第一次确认取消 → 返回重新输入<br>c. 第二次确认取消 → 表单已提交不可撤回，提示联系管理员<br>d. API 调用失败 → 返回错误信息 |

---

## 3. 系统架构设计

### 3.1 分层架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        Presentation Layer                       │
│                     (CLI - readline 交互)                       │
├─────────────────────────────────────────────────────────────────┤
│                        Workflow Layer                           │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │           WorkflowEngine (状态机)                          │  │
│  │                                                           │  │
│  │  COLLECTING → FILLING ⇄ VALIDATING                        │  │
│  │                    ↓                                      │  │
│  │           AWAITING_CONFIRM (表单)                          │  │
│  │                    ↓                                      │  │
│  │           SUBMITTING → AWAITING_CONFIRM (流程)            │  │
│  │                           ↓                               │  │
│  │                    STARTING_PROCESS                       │  │
│  │                           ↓                               │  │
│  │                    COMPLETED / FAILED                     │  │
│  └───────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                        Service Layer                            │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────────────────┐   │
│  │  LLMService │  │ FormValidator│  │   ApprovalAPI         │   │
│  │ (双协议)    │  │ (校验引擎)   │  │  (mock/real)          │   │
│  │ + Tool支持  │  │             │  │                       │   │
│  └──────┬──────┘  └─────────────┘  └───────────┬───────────┘   │
│         │                                        │              │
├─────────┼────────────────────────────────────────┼──────────────┤
│         │        Infrastructure Layer            │              │
│    ┌────┴─────────────┐                ┌─────────┴────────┐    │
│    │ Anthropic SDK    │                │   Mock / Real    │    │
│    │ OpenAI SDK       │                │   REST API       │    │
│    │ + Tool Protocol  │                │                  │    │
│    └──────────────────┘                └──────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 组件交互序列图

```
User    CLI      WorkflowEngine   LLMService     Validator    ApprovalAPI
 │        │            │              │              │             │
 │─输入──→│            │              │              │             │
 │        │──run()───→│              │              │             │
 │        │            │              │              │             │
 │        │            │─fillForm()─→│              │             │
 │        │            │              │─tool:get_date──→(本地)     │
 │        │            │              │←──2026-05-23─│             │
 │        │            │              │─LLM调用────→(远程API)     │
 │        │            │←─LeaveForm──│              │             │
 │        │            │              │              │             │
 │        │            │─validate()───────────────→│             │
 │        │            │←─{errors}─────────────────│             │
 │        │            │              │              │             │
 │        │  [校验失败: LLM修正循环]  │              │             │
 │        │            │              │              │             │
 │        │  [校验通过]              │              │             │
 │        │←─showForm()─│            │              │             │
 │        │            │              │              │             │
 │←─确认?─│            │              │              │             │
 │─yes──→│            │              │              │             │
 │        │─confirm()→│              │              │             │
 │        │            │─submitForm()──────────────────────────→│
 │        │            │←─{formId}─────────────────────────────│
 │        │            │              │              │             │
 │        │←─showProcess()─│         │              │             │
 │←─确认?─│            │              │              │             │
 │─yes──→│            │              │              │             │
 │        │─confirm()→│              │              │             │
 │        │            │─startProcess()───────────────────────→│
 │        │            │←─{processId}──────────────────────────│
 │        │            │              │              │             │
 │        │←─result()─│              │              │             │
 │←─结果─│            │              │              │             │
```

---

## 4. 模块详细设计

### 4.1 LLMService — LLM 服务层

**职责**: 封装 LLM 调用，支持 Anthropic / OpenAI 双协议 + Tool Use

**关键特性**:
- **双协议**: 根据 `LLM_PROVIDER` 配置自动选择 Anthropic SDK 或 OpenAI SDK
- **Tool 支持**: 内置 `get_current_date` 工具，LLM 填表时自动调用获取当前日期
- **Tool Use 循环**: Anthropic / OpenAI 路径均支持多轮 tool 调用（最多 3 轮）
- **JSON 提取**: 正则提取 `{...}`，兼容 markdown 代码块包裹
- **Zod 校验**: LLM 输出经 Zod schema 校验后再返回

**支持的 Provider**:

| Provider | 协议 | BaseURL | 默认模型 |
|----------|------|---------|---------|
| `glm-anthropic` | Anthropic | `api.z.ai/api/anthropic` | `glm-5-turbo` |
| `glm-openai` | OpenAI | `open.bigmodel.cn/api/paas/v4` | `glm-4-plus` |
| `deepseek` | OpenAI | `api.deepseek.com/v1` | `deepseek-chat` |
| `qwen` | OpenAI | `dashscope.aliyuncs.com` | `qwen-plus` |
| `openai` | OpenAI | `api.openai.com/v1` | `gpt-4o` |

### 4.2 FormValidator — 校验引擎

**职责**: 对 LLM 生成的表单执行多维度校验

| 校验维度 | 规则 |
|---------|------|
| 必填检查 | 所有 9 个字段不能为空 |
| 日期格式 | 必须为 YYYY-MM-DD |
| 日期逻辑 | 开始 ≤ 结束，不早于今天，跨度 ≤ 30 天 |
| 文本长度 | 原因 ≥ 10 字，工作安排 ≥ 20 字 |
| 联系方式 | 手机号(1开头11位)或邮箱格式 |

### 4.3 ApprovalAPI — 接口层

**职责**: 封装表单提交和流程发起的外部调用

| 方法 | 说明 | 当前实现 |
|------|------|---------|
| `submitForm(form)` | 提交表单，返回 `{ formId }` | Mock |
| `startProcess(formId, form)` | 发起流程，返回 `{ processId, message }` | Mock |

### 4.4 WorkflowEngine — 工作流引擎

**职责**: 状态机驱动，协调所有模块完成完整审批流程

**两次确认设计**:
1. **第一次确认** (`onConfirmForm`): 校验通过后展示申请表单，用户确认后提交获取 formId
2. **第二次确认** (`onConfirmProcess`): 展示含 formId 的流程表单，用户确认后发起审批流程

---

## 5. 数据模型设计

### 5.1 申请表单 (LeaveForm)

```typescript
interface LeaveForm {
  applicantName: string;      // 申请人姓名
  department: string;         // 部门
  employeeId: string;         // 工号
  remoteStartDate: string;    // 开始日期 YYYY-MM-DD
  remoteEndDate: string;      // 结束日期 YYYY-MM-DD
  reason: string;             // 远程办公原因
  workPlan: string;           // 工作安排
  emergencyContact: string;   // 紧急联系方式
  address: string;            // 远程办公地址
}
```

### 5.2 流程表单 (ProcessForm)

```typescript
interface ProcessForm {
  formId: string;             // 表单提交后获得的 ID
  applicantName: string;
  department: string;
  employeeId: string;
  remoteStartDate: string;
  remoteEndDate: string;
  reason: string;
  workPlan: string;
  emergencyContact: string;
  address: string;
}
```

### 5.3 工作流上下文 (WorkflowContext)

```typescript
interface WorkflowContext {
  state: WorkflowState;
  userInput: string;
  form?: LeaveForm;
  formId?: string;
  processId?: string;
  validationErrors: string[];
  retryCount: number;
  maxRetries: number;
}
```

---

## 6. 接口规范 (API Spec)

### 6.1 表单提交接口

```
POST /api/v1/forms
Content-Type: application/json

Request: LeaveForm JSON
Response 200: { success: true, formId: "FM-xxx", form: {...} }
Response 400: { success: false, errors: [...] }
```

### 6.2 流程发起接口

```
POST /api/v1/processes
Content-Type: application/json

Request: { formId: string, form: LeaveForm }
Response 200: { success: true, processId: "PS-xxx", message: "..." }
Response 500: { success: false, error: "..." }
```

---

## 7. 状态机与工作流设计

### 7.1 状态转换表

| 当前状态 | 事件 | 目标状态 | 动作 |
|---------|------|---------|------|
| COLLECTING | 用户输入 | FILLING_FORM | 调用 LLM 填表（可调用 Tool） |
| FILLING_FORM | LLM 返回表单 | VALIDATING | 保存表单，执行校验 |
| VALIDATING | 校验通过 | AWAITING_CONFIRM | 展示表单给用户（第一次确认） |
| VALIDATING | 校验失败 (retry < max) | FILLING_FORM | 传递错误给 LLM 修正 |
| VALIDATING | 校验失败 (retry ≥ max) | FAILED | 返回失败信息 |
| AWAITING_CONFIRM | 用户确认表单 | SUBMITTING | 调用表单提交 API |
| AWAITING_CONFIRM | 用户取消 | COLLECTING | 重新收集输入 |
| SUBMITTING | 提交成功 | AWAITING_CONFIRM | 展示流程表单（第二次确认） |
| SUBMITTING | 提交失败 | FAILED | 返回错误信息 |
| AWAITING_CONFIRM | 用户确认流程 | STARTING_PROCESS | 调用流程发起 API |
| AWAITING_CONFIRM | 用户取消流程 | COLLECTING | 提示表单已提交 |
| STARTING_PROCESS | 发起成功 | COMPLETED | 返回成功信息 |
| STARTING_PROCESS | 发起失败 | FAILED | 返回错误信息 |

---

## 8. Tool 设计

### 8.1 已注册工具

| 工具名 | 描述 | 参数 | 返回 |
|--------|------|------|------|
| `get_current_date` | 获取当前日期和时间 | 无 | `YYYY-MM-DD HH:mm:ss` |

### 8.2 Tool 调用流程

```
LLM → tool_use: get_current_date
         │
         ▼
   executeTool() → "2026-05-23 14:30:00"
         │
         ▼
LLM ← tool_result
         │
         ▼
LLM 生成包含正确日期的表单 JSON
```

### 8.3 扩展 Tool

在 `LLMService` 中添加新工具的步骤：
1. 在 `TOOLS` / `OPENAI_TOOLS` 中注册工具定义
2. 在 `executeTool()` 中添加工具实现
3. LLM 会根据工具描述自动决定是否调用

---

## 9. 技术选型与依赖

### 9.1 依赖清单

| 包名 | 版本 | 用途 |
|------|------|------|
| `@anthropic-ai/sdk` | ^0.53 | Anthropic 协议 LLM 调用 |
| `openai` | ^4.95 | OpenAI 协议 LLM 调用 |
| `zod` | ^3.24 | Schema 验证 + LLM 输出解析 |
| `dotenv` | ^16 | .env 环境变量加载 |
| `typescript` | ^5.7 | 编译器 (dev) |
| `tsx` | ^4.19 | TS 直接运行 (dev) |
| `vitest` | ^4.1 | 测试框架 (dev) |

### 9.2 配置项

| 环境变量 | 默认值 | 说明 |
|---------|--------|------|
| `LLM_PROVIDER` | `glm-openai` | LLM 提供商 |
| `LLM_API_KEY` | (必填) | API Key |
| `LLM_BASE_URL` | (预设) | 自定义 BaseURL |
| `LLM_MODEL` | (预设) | 自定义模型 |
| `MAX_FORM_RETRIES` | `5` | 表单修正最大重试次数 |
| `API_BASE_URL` | (空=mock) | 真实 API 地址 |

---

## 10. 项目结构

```
leave-approval-agent/
├── docs/
│   └── DESIGN.md              # 本设计文档
├── src/
│   ├── config.ts              # 配置管理 (dotenv)
│   ├── types.ts               # 类型定义
│   ├── index.ts               # CLI 入口 (两次确认交互)
│   ├── llm/
│   │   ├── index.ts
│   │   └── service.ts         # 通用 LLM Provider (双协议 + Tool)
│   ├── validator/
│   │   ├── index.ts
│   │   └── form-validator.ts  # 表单校验引擎
│   ├── api/
│   │   ├── index.ts
│   │   ├── client.ts          # API 客户端 (mock/real 切换)
│   │   └── mock.ts            # 模拟接口
│   └── workflow/
│       ├── index.ts
│       └── engine.ts          # 工作流状态机 (两次确认)
├── tests/
│   └── validator.test.ts      # 校验器单元测试
├── .env                        # 环境变量 (不入库)
├── .env.example                # 环境变量模板
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

---

## 11. 部署与运行

```bash
cd leave-approval-agent
npm install

# 配置 .env (参考 .env.example)
# LLM_PROVIDER=glm-anthropic
# LLM_API_KEY=your-key

npx tsx src/index.ts
```

---

## 12. 测试策略

| 层级 | 测试内容 | 工具 | 状态 |
|------|---------|------|------|
| 单元测试 | 校验器各规则 (10 cases) | vitest | ✅ 通过 |
| 单元测试 | LLM JSON 解析 | vitest | 待补充 |
| 集成测试 | Tool 调用流程 | vitest | 待补充 |
| E2E 测试 | 完整审批流程 | vitest | 待补充 |

---

## 13. 扩展性设计

- **接入真实 API**: 替换 `api/mock.ts` → `api/real.ts`
- **接入 IM 渠道**: 替换 CLI → Discord/Telegram/飞书适配器
- **多表单类型**: 通过表单模板配置化支持请假、出差等
- **新增 Tool**: 在 `LLMService` 中注册新工具定义和实现

---

## 14. 变更记录

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0.0 | 2026-05-23 | 初始设计 |
| v1.1.0 | 2026-05-23 | 1. 改为两次用户确认流程<br>2. 新增通用 LLM Provider (Anthropic/OpenAI 双协议)<br>3. 新增 `get_current_date` Tool 支持<br>4. 改用 dotenv 加载 .env 配置<br>5. 新增 `@anthropic-ai/sdk` 依赖 |
