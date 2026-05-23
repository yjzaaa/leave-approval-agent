# 插件化审批 Agent

基于 **Pi Agent Framework** + **DeepSeek API** 的多业务审批助手，支持 CLI 和 Web UI 两种交互模式。

## 🏗️ 架构

```
用户 → CLI / Web UI → Express SSE → Agent 框架 → 业务插件 → DeepSeek API
                                          ↕
                                    Human-in-the-Loop
                                    (业务决定，框架提供能力)
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

### HITL 设计

Human-in-the-Loop 不由框架硬编码，而是由业务插件通过 `confirmTools` 决定：

| 模式 | `confirmTools` 配置 | 场景 |
|------|---------------------|------|
| 两步确认 | `['xxx_submit', 'xxx_start']` | 高风险审批 |
| 单步确认 | `['xxx_submit']` | 低风险操作 |
| 全自动 | `[]` | 无需人工干预 |

框架只提供 HITL 能力（confirm-state 状态机 + ConfirmCard 组件），使用与否完全由业务决定。

### 目录结构

```
src/
├── main.tsx / App.tsx / App.css
│
├── agent/                          # ⚙️ Agent 框架层（业务无关）
│   ├── agent-factory.ts            #   Agent 工厂：根据 plugin 创建/运行 Agent
│   ├── confirm-state.ts            #   HITL 确认状态机（通用能力，非硬编码）
│   ├── types.ts                    #   框架级类型
│   └── tools/                      #   通用 Tool 工厂
│       ├── get-current-date.ts     #   获取当前日期
│       ├── validate-form.ts        #   校验表单（注入 plugin.validate）
│       ├── submit-form.ts          #   提交表单（检查 plugin.confirmTools 决定 HITL）
│       └── start-process.ts       #   发起流程（检查 plugin.confirmTools 决定 HITL）
│
├── plugins/                        # 📦 业务插件层
│   ├── registry.ts                 #   插件注册表
│   ├── leave-approval/             #   远程办公审批 (两步 HITL)
│   ├── expense-approval/           #   报销审批 (两步 HITL)
│   └── sick-leave/                 #   病假申请 (两步 HITL)
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
    ├── plugin.ts                   #   BusinessPlugin 接口（含 confirmTools）
    ├── types.ts                    #   领域类型
    └── config.ts                   #   全局配置
```

### 依赖方向

```
server → agent → plugins → shared
client → shared
agent → shared
agent 不依赖任何具体业务
```

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

### 创建插件

```bash
mkdir src/plugins/my-business
```

### 文件清单

| 文件 | 内容 | 必填 |
|------|------|------|
| `index.ts` | 导出 `BusinessPlugin` 实例 | 是 |
| `fields.ts` | 表单字段 `FieldMeta[]` | 是 |
| `prompt.ts` | System Prompt | 是 |
| `validator.ts` | 校验规则 | 是 |
| `api.ts` | 后端 API 调用 | 是（可用 Mock） |

### HITL 配置

```typescript
// 两步确认
confirmTools: ['my_business_submit', 'my_business_start'],
confirmLabels: {
  my_business_submit: '📋 确认提交',
  my_business_start: '🚀 确认发起',
},

// 全自动（无需人工确认）
confirmTools: [],
```

### 注册

```typescript
export const registry: PluginRegistry = {
  leave_approval: leavePlugin,
  my_business: myPlugin,  // ← 新增
};
```

**前端零改动**，通过 URL 参数 `/?plugin=my_business` 自动切换。

## 🎨 前端设计

| 特性 | 说明 |
|------|------|
| **Slate 极简主题** | 无渐变色，纯灰度排版构建层级 |
| **暗色/亮色/系统** | 三段式主题切换，localStorage 持久化 |
| **Markdown 渲染** | react-markdown + remark-gfm |
| **流水线指示器** | 就绪 → 处理中 → 等待确认 → 完成 |
| **HITL 通用弹窗** | ConfirmCard 由 confirmLabels 驱动，业务决定何时弹出 |
| **无障碍访问** | 焦点陷阱、ESC 关闭、aria 全覆盖 |

## 🛠️ 技术栈

| 层 | 技术 |
|----|------|
| 前端 | React 18, TypeScript, Vite 6, CSS Variables |
| 后端 | Express, Pi Agent Framework, SSE |
| AI | DeepSeek API (via Pi Framework) |
| Markdown | react-markdown, remark-gfm |
| 字体 | Inter + Noto Sans SC |

## 📄 License

MIT
