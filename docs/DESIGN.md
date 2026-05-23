# 远程办公申请自动化审批 Agent — 设计文档 v2.0

> **框架**: Pi Agent Framework (`@earendil-works/pi-agent-core` + `@earendil-works/pi-ai`)  
> **模型**: DeepSeek V4 Pro  
> **分支**: `feature/pi-framework`

---

## 1. 系统架构总览

```mermaid
graph TB
    subgraph User["👤 用户"]
        U1["输入远程办公需求"]
        U2["确认表单 ×2"]
    end

    subgraph CLI["🖥️ CLI 层 (index.ts)"]
        Readline["Readline 交互"]
        Subscribe["Agent 事件订阅<br/>tool_execution_start/end<br/>message_update/end<br/>agent_end"]
    end

    subgraph Agent["🧠 Pi Agent (agent.ts)"]
        direction TB
        SysPrompt["System Prompt<br/>——<br/>3 阶段工作流<br/>校验→确认→提交<br/>确认→发起"]
        Model["模型: deepseek-v4-pro<br/>Temperature: 0.1"]
        AgentLoop["Agent 自主决策循环<br/>prompt() → streamFn →<br/>解析响应 → 调用 Tool → 继续"]
    end

    subgraph Tools["🔧 Agent Tools"]
        T1["get_current_date<br/>📅 获取当前日期"]
        T2["validate_form<br/>✅ 校验表单<br/>↻ 最多重试 5 次"]
        T3["submit_form<br/>📤 提交表单<br/>🔒 需用户确认"]
        T4["start_process<br/>🚀 发起审批流程<br/>🔒 需用户二次确认"]
    end

    subgraph Backend["⚙️ 后端服务 (Mock)"]
        API["Mock API<br/>submitForm → formId<br/>startProcess → processId"]
        Validator["Validator<br/>字段校验引擎<br/>日期/字数/格式"]
    end

    U1 --> Readline
    Readline --> Agent
    Agent --> AgentLoop
    AgentLoop --> Model
    AgentLoop --> Tools
    Subscribe --> U2
    U2 --> Readline
    T1 --> AgentLoop
    T2 --> Validator
    T3 --> API
    T4 --> API

    style User fill:#e1f5fe,stroke:#0288d1
    style CLI fill:#fff9c4,stroke:#f9a825
    style Agent fill:#e8f5e9,stroke:#388e3c
    style Tools fill:#f3e5f5,stroke:#7b1fa2
    style Backend fill:#fce4ec,stroke:#c62828
```

---

## 2. Human-in-the-Loop 交互序列

```mermaid
sequenceDiagram
    autonumber
    actor User as 👤 用户
    participant CLI as 🖥️ CLI
    participant Agent as 🧠 Pi Agent
    participant Tools as 🔧 Tools
    participant API as ⚙️ Mock API

    %% ===== Phase 1: 填写 & 校验 =====
    rect rgb(232, 245, 233)
        Note over User,API: Phase 1 — 智能填表 & 校验循环
        User->>CLI: "家里有事需要远程办公3天"
        CLI->>Agent: prompt(userInput)

        Agent->>Tools: get_current_date()
        Tools-->>Agent: 2026-05-23 17:00:00

        Agent->>Agent: LLM 推理填写表单<br/>推断部门/工期/工作安排

        Agent->>Tools: validate_form(form)
        Tools-->>Agent: ❌ { valid: false, errors: […] }

        Note over Agent: 根据 errors 修正

        Agent->>Tools: validate_form(form) ← 重试
        Tools-->>Agent: ✅ { valid: true, errors: [] }
    end

    %% ===== 第一次确认 =====
    rect rgb(232, 234, 246)
        Note over User,API: 🔒 Human-in-the-Loop — 第一次确认
        Agent-->>CLI: 📋 展示表单
        CLI-->>User: 「申请人: 张三, 部门: 研发部<br/>日期: 2026-05-26 ~ 2026-05-28<br/>原因: 照顾家人…<br/>确认提交?」

        User->>CLI: "确认" ✅
        CLI->>Agent: prompt("确认")

        Agent->>Tools: submit_form(form)
        Tools->>API: POST /submit
        API-->>Tools: { formId: "FM-xxx" }
        Tools-->>Agent: formId = "FM-xxx"
    end

    %% ===== 第二次确认 =====
    rect rgb(255, 243, 224)
        Note over User,API: 🔒 Human-in-the-Loop — 第二次确认
        Agent-->>CLI: 📄 流程预览 (含 formId)
        CLI-->>User: 「审批流程单<br/>表单ID: FM-xxx<br/>确认发起审批?」

        User->>CLI: "确认" ✅
        CLI->>Agent: prompt("确认")

        Agent->>Tools: start_process(formId, form)
        Tools->>API: POST /start-process
        API-->>Tools: { processId: "PS-xxx" }
        Tools-->>Agent: processId = "PS-xxx"
    end

    Agent-->>CLI: 🎉 审批流程已发起！
    CLI-->>User: 「✅ 流程发起成功<br/>表单ID: FM-xxx<br/>流程ID: PS-xxx」
```

---

## 3. Agent 内部决策循环

```mermaid
flowchart TD
    Start(["👤 用户输入需求"]) --> GetDate["🔧 get_current_date<br/>获取当前日期"]
    GetDate --> Infer["🧠 LLM 推断填表<br/>— 补全缺失字段<br/>— 日期 YYYY-MM-DD<br/>— 原因 ≥10 字<br/>— 工作安排 ≥20 字"]

    Infer --> Validate["🔧 validate_form"]

    Validate -->|"❌ invalid"| Fix["🔄 LLM 修正<br/>根据 errors 调整"]
    Fix -->|"已达 5 次上限"| Fail(["❌ 提示用户<br/>手动修正"])
    Fix --> Validate

    Validate -->|"✅ valid"| Show1["📋 展示表单<br/>等待用户确认"]

    Show1 --> Confirm1{"👤 用户确认?"}
    Confirm1 -->|"❌ 拒绝/修改"| Infer
    Confirm1 -->|"✅ 确认"| Submit["🔧 submit_form"]
    Submit -->|"📤 提交成功"| Show2["📄 展示流程单<br/>含 formId<br/>等待二次确认"]

    Show2 --> Confirm2{"👤 二次确认?"}
    Confirm2 -->|"❌ 拒绝"| Show1
    Confirm2 -->|"✅ 确认"| StartProc["🔧 start_process"]
    StartProc --> Done(["🎉 流程发起成功<br/>formId + processId"])

    style Confirm1 fill:#fff9c4,stroke:#f9a825,stroke-width:3px
    style Confirm2 fill:#fff9c4,stroke:#f9a825,stroke-width:3px
    style Show1 fill:#e8f5e9,stroke:#388e3c
    style Show2 fill:#e8f5e9,stroke:#388e3c
    style Done fill:#c8e6c9,stroke:#2e7d32,stroke-width:2px
```

---

## 4. 组件关系 & 数据流

```mermaid
graph LR
    subgraph "src/"
        direction TB
        A["agent.ts<br/>——<br/>📝 System Prompt<br/>🔧 4个 Tool<br/>🧠 Model 选择"]
        B["index.ts<br/>——<br/>🖥️ CLI 交互<br/>📡 Agent 事件订阅<br/>🔄 对话循环"]
        C["validator.ts<br/>——<br/>✅ 9项校验规则<br/>日期/字数/格式"]
        D["api.ts<br/>——<br/>📤 Mock submitForm<br/>🚀 Mock startProcess"]
        E["config.ts<br/>——<br/>⚙️ 配置管理<br/>MAX_FORM_RETRIES"]
        F["types.ts<br/>——<br/>📐 TypeScript 类型"]
    end

    subgraph "Pi Framework"
        G["@earendil-works/pi-agent-core<br/>——<br/>Agent 类<br/>事件系统<br/>状态管理"]
        H["@earendil-works/pi-ai<br/>——<br/>streamSimple<br/>getModel<br/>Type (Typebox)"]
    end

    subgraph "LLM Provider"
        I["DeepSeek API<br/>——<br/>deepseek-v4-pro<br/>DEEPSEEK_API_KEY"]
    end

    A -->|import Type, getModel| H
    A -->|import Agent| G
    A -->|call| C
    A -->|call| D
    B -->|new Agent| A
    B -->|subscribe events| G
    G -->|streamFn| H
    H -->|HTTP| I
    E --> A
    F --> A
    F --> C
    F --> D

    style A fill:#e8f5e9,stroke:#388e3c,stroke-width:2px
    style B fill:#fff9c4,stroke:#f9a825,stroke-width:2px
    style I fill:#e1f5fe,stroke:#0288d1,stroke-width:2px
```

---

## 5. Pi Agent 事件流

```mermaid
sequenceDiagram
    participant CLI as 🖥️ index.ts
    participant PA as 🧠 Pi Agent
    participant Stream as 🌊 streamSimple
    participant LLM as ☁️ DeepSeek API

    CLI->>PA: agent.prompt(userInput)
    PA->>PA: emit "agent_start"

    loop 自主决策循环
        PA->>Stream: streamSimple(model, context, opts)
        Stream->>LLM: POST /v1/chat/completions
        LLM-->>Stream: SSE stream

        alt 流式文本
            Stream-->>PA: text_delta chunks
            PA->>CLI: emit "message_update" (text_delta)
            CLI->>CLI: process.stdout.write(delta)
        else Tool Call
            Stream-->>PA: tool_use block
            PA->>CLI: emit "tool_execution_start" (toolName)
            PA->>PA: 执行 Tool.execute()
            PA->>CLI: emit "tool_execution_end"
            PA->>Stream: 将 Tool 结果传回 LLM
        end
    end

    LLM-->>Stream: finished (stop/tool_use)
    Stream-->>PA: end event
    PA->>CLI: emit "message_end"
    PA->>CLI: emit "agent_end" (含 messages[])
    CLI->>CLI: await agent.waitForIdle()
```

---

## 6. Tool 定义一览

| Tool | 参数 | 返回 | 调用条件 |
|------|------|------|---------|
| `get_current_date` | 无 | `2026-05-23 17:00:00` | 填表前必调用 |
| `validate_form` | `{ form: LeaveForm }` | `{ valid, errors[] }` | 填表后 / 修正后 |
| `submit_form` | `{ form: LeaveForm }` | `{ formId: "FM-xxx" }` | **用户确认后** |
| `start_process` | `{ formId, form }` | `{ processId: "PS-xxx" }` | **用户二次确认后** |

### 校验规则 (Validator)

| 字段 | 规则 |
|------|------|
| `applicantName` | 非空 |
| `department` | 非空 |
| `employeeId` | 非空 |
| `remoteStartDate` | YYYY-MM-DD，不早于当前日期 |
| `remoteEndDate` | YYYY-MM-DD，不早于开始日期，跨度 ≤ 30 天 |
| `reason` | ≥ 10 字 |
| `workPlan` | ≥ 20 字 |
| `emergencyContact` | 手机号 (1xx) 或邮箱 |
| `address` | 非空 |

---

## 7. System Prompt 结构

```
你是远程办公申请自动化审批助手。

Phase 1: 填写表单
  1. get_current_date → 获取日期
  2. 推断填写表单
  3. validate_form → 校验 (不通过则修正，最多5次)
  4. 展示表单 → 等待用户确认

Phase 2: 第一次确认 → 提交
  用户确认 → submit_form → 获取 formId

Phase 3: 第二次确认 → 发起
  展示含 formId 流程单 → 等待确认
  确认 → start_process → 完成

规则:
  - 日期 YYYY-MM-DD, 不早于今天, 跨度≤30天
  - 原因≥10字, 工作安排≥20字
  - 联系方式 手机号|邮箱
  - 提交/发起前 必须用户明确确认
```

---

## 8. 关键设计决策

| 决策 | 理由 |
|------|------|
| **两次确认** | 表单内容 + 流程发起 分开确认，防止误操作 |
| **Pi Agent 框架** | 复用 53k⭐ 成熟项目的 Agent 循环、事件系统、Provider 抽象 |
| **Typebox Schema** | Pi 框架原生支持，类型安全 + 运行时校验 |
| **DeepSeek Provider** | 系统已有 DEEPSEEK_API_KEY，无需额外配置 |
| **校验循环内置** | Agent 自主根据 errors 修正，减少用户交互次数 |
| **LLM 推断填表** | 用户只需描述需求，Agent 推断部门/工期/安排等字段 |
