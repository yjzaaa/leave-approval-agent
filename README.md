# 插件化审批 Agent

基于 **Pi Agent Framework** + **DeepSeek API** 的多业务审批助手，支持 CLI 和 Web UI 两种交互模式。

## 🏗️ 架构

```
用户 → CLI / Web UI → Express SSE → Agent 框架 → 业务插件 → DeepSeek API
                                          ↕
                                    Human-in-the-Loop
                                          ↕
                                    确认卡片 ←→ 用户确认/拒绝
```

### 三层架构

```
┌──────────────────────────────────────────────┐
│  🖥️ UI 壳层 (React)    聊天/审批/布局组件     │
├──────────────────────────────────────────────┤
│  ⚙️ Agent 框架层        创建/调度/SSE/HITL    │
├──────────────────────────────────────────────┤
│  📦 业务插件层          远程办公/报销/请假...  │
└──────────────────────────────────────────────┘
```

### 目录结构

```
src/
├── main.tsx / App.tsx / App.css
│
├── agent/                          # ⚙️ Agent 框架层（业务无关）
│   ├── agent-factory.ts            #   Agent 工厂：根据 plugin 创建/运行 Agent
│   ├── confirm-state.ts            #   HITL 确认状态机
│   ├── types.ts                    #   框架级类型
│   └── tools/                      #   通用 Tool 工厂
│       ├── get-current-date.ts     #   获取当前日期
│       ├── validate-form.ts        #   校验表单（注入 plugin.validate）
│       ├── submit-form.ts          #   提交表单（注入 plugin.submitApi）
│       └── start-process.ts       #   发起流程（注入 plugin.startProcessApi）
│
├── plugins/                        # 📦 业务插件层
│   ├── registry.ts                 #   插件注册表
│   └── leave-approval/             #   远程办公审批插件
│       ├── index.ts                #   导出 BusinessPlugin 实例
│       ├── fields.ts               #   表单字段元数据
│       ├── prompt.ts               #   System Prompt
│       ├── validator.ts            #   校验规则
│       └── api.ts                  #   Mock API
│
├── client/                         # 🖥️ 前端 UI
│   ├── types.ts
│   ├── hooks/useAgent.ts
│   └── components/
│       ├── chat/      (ChatContainer, MessageBubble, InputBar)
│       ├── approval/  (StatusBar, ConfirmCard)
│       └── layout/    (Header, ThemeToggle)
│
├── server/                         # 🔧 服务端
│   ├── index.ts                    #   Express 路由（插件注入）
│   └── cli.ts                      #   CLI 入口（支持 --plugin=xxx）
│
└── shared/                         # 📋 共享类型
    ├── plugin.ts                   #   BusinessPlugin 接口
    ├── types.ts                    #   领域类型
    └── config.ts                   #   全局配置
```

### 依赖方向

```
server → agent → plugins → shared
client → shared
agent → shared
```

- **agent/** 不依赖任何具体业务
- **server/** 选择并注入活动插件
- **client/** 通过 shared 泛化类型通信
- **plugins/** 只依赖 shared

## 🚀 快速开始

### 环境要求

- Node.js >= 18
- DeepSeek API Key

### 安装

```bash
npm install
```

配置 `.env`：

```env
DEEPSEEK_API_KEY=sk-your-key-here
MAX_FORM_RETRIES=5
PORT=3000
```

### CLI 模式

```bash
npm run cli                     # 默认远程办公审批
npm run cli -- --plugin=xxx     # 指定插件
```

### Web UI 模式

```bash
npm run dev:all                 # 同时启动前后端
npm run dev:server              # Express → http://localhost:3000
npm run dev                     # Vite   → http://localhost:5173
```

## 📦 扩展新业务

接入新的审批类型只需创建 4-5 个文件：

```
src/plugins/expense-approval/
├── index.ts      # export const expensePlugin: BusinessPlugin = { ... }
├── fields.ts     # FieldMeta[]
├── prompt.ts     # System Prompt
├── validator.ts  # validate(form) → { valid, errors[] }
└── api.ts        # submit / start API
```

然后在 `plugins/registry.ts` 注册：

```typescript
export const registry: PluginRegistry = {
  leave_approval: leavePlugin,
  expense_approval: expensePlugin,  // ← 新增
};
```

前端**零改动**，通过 URL 参数 `/?plugin=expense_approval` 自动切换。

## 🎨 前端设计

| 特性 | 说明 |
|------|------|
| **Slate 极简主题** | 无渐变色，纯灰度排版构建层级 |
| **暗色/亮色/系统** | 三段式主题切换，localStorage 持久化 |
| **Markdown 渲染** | react-markdown + remark-gfm，完整 GFM 支持 |
| **流水线指示器** | 就绪 → 处理中 → 等待确认 → 完成 |
| **两步确认** | 表单确认 + 流程确认，防重复推送 |
| **无障碍访问** | 焦点陷阱、ESC 关闭、aria 全覆盖 |

## 🛠️ 技术栈

| 层 | 技术 |
|----|------|
| 前端 | React 18, TypeScript, Vite 6, CSS Variables |
| 后端 | Express, Pi Agent Framework, SSE |
| AI | DeepSeek API (via Pi Framework) |
| Markdown | react-markdown, remark-gfm |
| 字体 | Inter + Noto Sans SC |

## 📊 业务流程图

```
用户描述需求
   ↓
Agent 收集信息
   ↓
提交确认 ──→ 🔒 用户确认表单内容
   ↓
流程确认 ──→ 🔒 用户确认发起流程
   ↓
完成 → 返回流程 ID
```

## 📄 License

MIT
