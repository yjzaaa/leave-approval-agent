# 远程办公申请自动化审批 Agent — 设计文档 v2.1

> **框架**: Pi Agent Framework (`@earendil-works/pi-agent-core` + `@earendil-works/pi-ai`)  
> **模型**: DeepSeek V4 Pro  
> **分支**: `feature/pi-framework`  
> **前端**: React 18 + Vite 6 + TypeScript

---

## 1. 系统架构全景

```mermaid
graph TB
    subgraph User["👤 用户"]
        U1["描述远程办公需求"]
        U2["确认表单 ✓/✗"]
        U3["确认发起 ✓/✗"]
    end

    subgraph Frontend["🖥️ 前端 (React 18 + Vite)"]
        direction TB
        WebUI["Web UI<br/>Slate 极简主题<br/>主题切换<br/>Markdown 渲染"]
        Components["组件分层<br/>chat / approval / layout"]
        Hook["useAgent Hook<br/>SSE 流处理<br/>状态机"]
        StatusBar["StatusBar<br/>流水线进度"]
        ConfirmCard["ConfirmCard<br/>焦点陷阱 / ESC"]
    end

    subgraph Backend["⚙️ 后端 (Express + SSE)"]
        Server["Express Server<br/>POST /api/chat (SSE)<br/>POST /api/confirm"]
    end

    subgraph Agent["🧠 Pi Agent"]
        direction TB
        SysPrompt["System Prompt<br/>3 阶段工作流<br/>推断→校验→确认→提交<br/>确认→发起"]
        Model["模型: deepseek-v4-pro<br/>Temperature: 0.1"]
        AgentLoop["Agent 自主决策循环<br/>prompt() → streamFn →<br/>LLM 响应 → 调用 Tool → 循环"]
    end

    subgraph Tools["🔧 Agent Tools"]
        T1["get_current_date<br/>📅 获取当前日期"]
        T2["validate_form<br/>✓ 校验表单<br/>🔄 最多重试 5 次"]
        T3["submit_form<br/>📤 提交表单<br/>🔒 需用户确认"]
        T4["start_process<br/>🚀 发起审批流程<br/>🔒 需用户二次确认"]
    end

    subgraph BackendLayer["📡 后端服务 (Mock)"]
        API["Mock API<br/>submitForm → formId<br/>startProcess → processId"]
        Validator["Validator<br/>字段校验规则<br/>类型/长度/格式"]
    end

    U1 --> WebUI
    WebUI --> Hook
    Hook -->|"SSE stream"| Server
    Server --> Agent
    Agent --> AgentLoop
    AgentLoop --> Model
    AgentLoop --> Tools
    U2 --> ConfirmCard
    U3 --> ConfirmCard
    ConfirmCard -->|"POST /api/confirm"| Server
    StatusBar --> Hook
    T1 --> AgentLoop
    T2 --> Validator
    T3 --> API
    T4 --> API

    style User fill:#e1f5fe,stroke:#0288d1
    style Frontend fill:#fff3e0,stroke:#e65100
    style Backend fill:#e8f5e9,stroke:#388e3c
    style Agent fill:#f3e5f5,stroke:#7b1fa2
    style Tools fill:#e8eaf6,stroke:#283593
    style BackendLayer fill:#fce4ec,stroke:#c62828
```

---

## 2. 前端架构 (Clean Architecture)

```
src/
├── main.tsx                     # Vite/React 入口
├── App.tsx / App.css            # 根组件 & 设计系统
│
├── client/                      # ── 🖥️ 前端层 ──
│   ├── types.ts                 #   前端类型
│   ├── hooks/
│   │   └── useAgent.ts         #   状态机 (SSE + 确认 + 去重)
│   └── components/
│       ├── chat/                #   聊天功能
│       │   ├── ChatContainer   #   消息列表 + 空状态 + 滚动到底
│       │   ├── MessageBubble   #   Markdown 渲染
│       │   └── InputBar        #   输入框 + 字符计数
│       ├── approval/            #   审批功能
│       │   ├── StatusBar       #   流水线步骤指示器
│       │   └── ConfirmCard     #   确认弹窗 (焦点陷阱)
│       └── layout/              #   布局
│           ├── Header          #   顶部导航
│           └── ThemeToggle     #   主题切换
│
├── server/                      # ── ⚙️ 后端层 ──
│   ├── index.ts                 #   Express + SSE
│   ├── agent.ts                 #   Agent 工具 & 提示词
│   ├── api.ts                   #   Mock API
│   ├── validator.ts             #   校验规则
│   └── cli.ts                   #   CLI 入口
│
└── shared/                      # ── 🔗 共享层 ──
    ├── types.ts                 #   领域类型
    └── config.ts                #   全局配置
```

**分层依赖**: `client → shared ← server`，client 和 server 互不依赖。

---

## 3. 前端设计系统

### 3.1 色彩体系

| 角色 | 亮色 | 暗色 |
|------|------|------|
| 根背景 | `#fcfcfb` | `#0c0c0b` |
| 默认表面 | `#ffffff` | `#181817` |
| 悬浮表面 | `#f3f3f0` | `#262625` |
| 主文字 | `#141413` | `#ededec` |
| 次文字 | `#63635e` | `#a1a09c` |
| 边框 | `#ebebe8` | `rgba(255,255,255,0.08)` |
| 强调色 | `#334155` (slate) | `#94a3b8` (slate) |

### 3.2 组件设计

| 组件 | 功能 | 关键实现 |
|------|------|---------|
| **ThemeToggle** | 三段循环 (系统→暗→亮) | localStorage 持久化，`data-theme` 属性 |
| **StatusBar** | 流水线步骤 | `idle→thinking→filling→validating→confirming→done` |
| **ChatContainer** | 空状态 + 滚动 | 快捷建议语、滚动偏离按钮 |
| **MessageBubble** | Markdown 渲染 | react-markdown + remark-gfm |
| **ConfirmCard** | 确认弹窗 | 焦点陷阱、ESC关闭、遮罩点击关闭 |
| **InputBar** | 输入框 | 字数计数、SVG 发送图标、快捷语联动 |

### 3.3 Markdown 渲染支持

- 标题 (h1-h4)、加粗、斜体、删除线
- 行内代码 + 代码块
- 有序/无序列表、嵌套列表
- 引用块、分割线
- 表格 (GFM)
- 链接
- 用户/助手双模式颜色适配

---

## 4. Human-in-the-Loop 流程

```mermaid
sequenceDiagram
    autonumber
    actor User as 👤 用户
    participant UI as 🖥️ Web UI
    participant SSE as 📡 SSE Stream
    participant Agent as 🧠 Pi Agent
    participant Tools as 🔧 Tools
    participant API as 📡 Mock API

    %% Phase 1: 填写 & 校验
    rect rgb(232, 245, 233)
        Note over User,API: Phase 1 — 信息收集 & 校验
        User->>UI: "我需要远程办公3天"
        UI->>SSE: POST /api/chat
        SSE->>Agent: prompt()
        Agent->>Tools: get_current_date()
        Tools-->>Agent: "2026-05-23"
        Agent->>Agent: LLM 推断补全表单
        Agent->>Tools: validate_form(form)
        Tools-->>Agent: ✗ { valid: false, errors: [...] }
        Agent->>Agent: 根据 errors 修复
        Agent->>Tools: validate_form(form)
        Tools-->>Agent: ✓ { valid: true, errors: [] }
    end

    %% 第一次确认
    rect rgb(232, 234, 246)
        Note over User,API: 🔒 第一次确认 — 表单提交
        Agent-->>SSE: event: confirm_required (submit_form)
        SSE-->>UI: ConfirmCard 弹出
        UI-->>User: 表单预览 + "确认提交?"
        User->>UI: 确认 ✓
        UI->>SSE: POST /api/confirm { approved: true }
        Agent->>Tools: submit_form(form)
        Tools->>API: submitForm()
        API-->>Tools: { formId: "FM-xxx" }
    end

    %% 第二次确认
    rect rgb(255, 243, 224)
        Note over User,API: 🔒 第二次确认 — 发起流程
        Agent-->>SSE: event: confirm_required (start_process)
        SSE-->>UI: ConfirmCard 弹出
        UI-->>User: 流程预览 + "确认发起?"
        User->>UI: 确认 ✓
        UI->>SSE: POST /api/confirm { approved: true }
        Agent->>Tools: start_process(formId, form)
        Tools->>API: startProcess()
        API-->>Tools: { processId: "PS-xxx" }
    end

    Agent-->>SSE: event: done
    SSE-->>UI: "流程发起成功"
    UI-->>User: ✓ formId + processId
```

---

## 5. Agent 决策流程

```mermaid
flowchart TD
    Start(["👤 用户输入需求"]) --> GetDate["📅 get_current_date"]
    GetDate --> Infer["🧠 LLM 推断表单<br/>• 补全缺失字段<br/>• 格式化 YYYY-MM-DD<br/>• 原因 ≥10 字<br/>• 工作安排 ≥20 字"]

    Infer --> Validate["✓ validate_form"]

    Validate -->|"✗ invalid"| Fix["🔄 LLM 根据 errors 修复"]
    Fix -->|"已达 5 次上限"| Fail(["❌ 提示用户<br/>手动修正"])
    Fix --> Validate

    Validate -->|"✓ valid"| Show1["📋 展示表单<br/>等待确认"]

    Show1 --> Confirm1{"🔒 用户确认?"}
    Confirm1 -->|"✗ 拒绝"| Infer
    Confirm1 -->|"✓ 确认"| Submit["📤 submit_form"]
    Submit -->|"获取 formId"| Show2["📋 展示流程单<br/>等待二次确认"]

    Show2 --> Confirm2{"🔒 用户确认?"}
    Confirm2 -->|"✗ 拒绝"| Show1
    Confirm2 -->|"✓ 确认"| StartProc["🚀 start_process"]
    StartProc --> Done(["✅ 完成<br/>formId + processId"])

    style Confirm1 fill:#fff9c4,stroke:#f9a825,stroke-width:3px
    style Confirm2 fill:#fff9c4,stroke:#f9a825,stroke-width:3px
    style Done fill:#c8e6c9,stroke:#2e7d32,stroke-width:2px
```

---

## 6. SSE 事件流

| 事件 | 方向 | 数据 | 说明 |
|------|------|------|------|
| `text` | server→client | `{ content: string }` | AI 流式文本输出 |
| `tool_result` | server→client | `{ tool, error }` | Tool 执行结果 |
| `confirm_required` | server→client | `{ tool, label, form, fieldLabels }` | 弹出确认卡片 |
| `confirm_resolved` | server→client | `{ tool }` | 确认已处理 |
| `done` | server→client | `{}` | Agent 执行完毕 |
| `error` | server→client | `{ message }` | 错误信息 |

**确认去重机制**: 前端 `useAgent` 使用 `lastConfirmToolRef` 按 tool 名去重，防止 SSE 重复推送同一确认。

---

## 7. Tool 详情

| Tool | 输入 | 输出 | 确认 |
|------|------|------|------|
| `get_current_date` | 无 | `2026-05-23 17:00:00` | 否 |
| `validate_form` | `{ form: LeaveForm }` | `{ valid, errors[] }` | 否 |
| `submit_form` | `{ form: LeaveForm }` | `{ formId }` | **是 (第一次)** |
| `start_process` | `{ formId, form }` | `{ processId }` | **是 (第二次)** |

### 校验规则

| 字段 | 规则 |
|------|------|
| `applicantName` | 非空 |
| `department` | 非空 |
| `employeeId` | 非空 |
| `remoteStartDate` | YYYY-MM-DD，≥ 当前日期 |
| `remoteEndDate` | YYYY-MM-DD，≥ 开始日期，≤ 30 天 |
| `reason` | ≥ 10 字 |
| `workPlan` | ≥ 20 字 |
| `emergencyContact` | 手机号格式 |
| `address` | 非空 |

---

## 8. 确认流程防重复

```mermaid
flowchart LR
    SSE["📡 SSE 推送<br/>confirm_required"] --> Check{"lastConfirmToolRef<br/>=== data.tool ?"}
    Check -->|"否 (新确认)"| Show["✅ 显示弹窗"]
    Check -->|"是 (重复)"| Skip["🚫 忽略"]
    Show --> UserAction{"用户操作"}
    UserAction -->|"确认/拒绝"| Set["lastConfirmToolRef = tool<br/>关闭弹窗"]
```

---

## 9. 关键设计决策

| 决策 | 理由 |
|------|------|
| **两次确认** | 表单提交和流程发起分开确认，防止误操作 |
| **Slate 极简主题** | 去蓝紫渐变，以文字层级和表面层次区分信息 |
| **SSE 流式** | 实时展示 AI 思考过程，提升交互感 |
| **Pi Agent 框架** | 53k token 上下文，Agent 自主决策循环，事件系统 |
| **Typebox Schema** | Pi 原生支持，类型安全 + 运行时校验 |
| **校验重试** | Agent 自主根据 errors 修复，最多 5 次 |
| **LLM 推断** | 用户只需描述需求，Agent 推断补全所有字段 |
| **Markdown 渲染** | 格式化 AI 回复，表格/代码/列表清晰可读 |
| **主题切换** | 系统/暗色/亮色三段式，localStorage 持久化 |
| **Clean Architecture** | client/server/shared 三层分离，单向依赖 |
