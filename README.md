# 远程办公申请自动化审批 Agent

基于 **Pi Agent Framework** + **DeepSeek API** 的智能审批助手，支持 CLI 和 Web UI 两种交互模式。

## 🏗️ 架构

```
用户 → CLI / Web UI → Express SSE → Pi Agent → DeepSeek API
                              ↑            ↓
                         Human-in-the-Loop  Tool 调用
                              ↓            ↓
                         确认卡片 ←── submit_form / start_process
```

### 目录结构

```
src/
├── main.tsx                     # React 入口
├── App.tsx / App.css            # 根组件 & 全局样式
│
├── client/                      # ── 前端层 ──
│   ├── types.ts                 #   前端类型 (Message, ConfirmRequest, AgentPhase)
│   ├── hooks/
│   │   └── useAgent.ts         #   聊天状态机 (SSE 流处理, 确认逻辑)
│   └── components/
│       ├── chat/                #   聊天功能
│       │   ├── ChatContainer.tsx
│       │   ├── MessageBubble.tsx  # Markdown 渲染 (react-markdown)
│       │   └── InputBar.tsx
│       ├── approval/            #   审批功能
│       │   ├── StatusBar.tsx    #   流水线步骤 (就绪→分析→填表→校验→确认→完成)
│       │   └── ConfirmCard.tsx  #   确认弹窗 (焦点陷阱/ESC/遮罩关闭)
│       └── layout/              #   布局
│           ├── Header.tsx
│           └── ThemeToggle.tsx  #   主题切换 (跟随系统/暗色/亮色)
│
├── server/                      # ── 后端层 ──
│   ├── index.ts                 #   Express 服务 + SSE 流式
│   ├── agent.ts                 #   Agent 工具定义 & 系统提示词
│   ├── api.ts                   #   Mock API (表单提交/流程发起)
│   ├── validator.ts             #   表单校验逻辑
│   └── cli.ts                   #   CLI 入口
│
└── shared/                      # ── 共享层 ──
    ├── types.ts                 #   领域类型 (LeaveForm, ProcessForm 等)
    └── config.ts                #   全局配置
```

### 分层原则

```
client → shared ← server
   ↑                 ↑
   └── 不互相依赖 ──┘
```

- **shared** — 纯类型和配置，零依赖
- **client** — React 前端，仅依赖 shared
- **server** — Express 后端，仅依赖 shared

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
npm run cli
```

### Web UI 模式

```bash
# 同时启动前端 + 后端
npm run dev:all

# 或分别启动
npm run dev:server   # Express → http://localhost:3000
npm run dev          # Vite    → http://localhost:5173
```

## 🎨 前端特性

| 特性 | 说明 |
|------|------|
| **Slate 极简主题** | 无渐变色，靠表面层次和文字排版构建层级 |
| **暗色/亮色/系统** | 三段式主题切换，localStorage 持久化 |
| **Markdown 渲染** | react-markdown + remark-gfm，完整 GFM 支持 |
| **流水线进度** | 就绪 → 分析 → 填表 → 校验 → 确认 → 完成 |
| **两步确认** | 表单确认 → 审批流程确认，弹窗不重复 |
| **焦点陷阱** | 确认弹窗内 Tab 循环、ESC 关闭 |
| **响应式** | 640px 断点、iOS 防缩放、safe-area-inset-bottom |
| **无障碍** | aria 全覆盖、focus-visible、prefers-reduced-motion |

## 🔧 技术栈

| 层 | 技术 |
|----|------|
| 前端 | React 18, TypeScript, Vite 6, CSS Variables |
| 后端 | Express, Pi Agent Framework, SSE |
| AI | DeepSeek API (via Pi Framework) |
| Markdown | react-markdown, remark-gfm |
| 字体 | Inter + Noto Sans SC |

## 🧪 测试

```bash
npm test
```

## 📖 工作流程

```
用户输入需求
   ↓
Agent 对话收集信息
   ↓
提交表单 (submit_form)
   ↓
🔒 用户确认表单内容
   ↓
发起审批流程 (start_process)
   ↓
🔒 用户确认发起
   ↓
完成 → 返回流程 ID
```

## 📄 License

MIT
