# 模拟用户登录 + 前端信息持久化

> 日期: 2026-05-24
> 状态: 已确认
> 方案: localStorage 按用户 ID 命名空间隔离

## 背景

当前系统无用户身份概念，所有 localStorage 数据（记忆、主题）属于匿名用户。需要模拟登录让多用户演示更真实，同时按用户隔离持久化数据。

## 核心决策

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 用户来源 | 前端硬编码用户列表 | 纯模拟，无需后端认证 |
| 隔离方式 | localStorage key 命名空间 | 最小改动，现有架构兼容 |
| 后端改动 | 零 | 纯前端实现 |

## 用户模型

```ts
interface MockUser {
  id: string;          // 唯一标识
  name: string;        // 显示名
  role: string;        // 'employee' | 'manager' | 'admin'
  department: string;  // 部门
  avatar: string;      // emoji 头像
}
```

预置 4 个用户：

| id | 姓名 | 角色 | 部门 | 头像 |
|---|---|---|---|---|
| zhangsan | 张三 | employee | 技术部 | 👨‍💻 |
| lisi | 李四 | manager | 产品部 | 👩‍💼 |
| wangwu | 王五 | employee | 设计部 | 🎨 |
| admin | 管理员 | admin | 管理层 | 🏢 |

## 数据隔离

所有按用户隔离的数据通过 localStorage key 后缀 `{userId}` 区分：

| key 格式 | 内容 | 隔离 |
|----------|------|------|
| `current_user_id` | 当前登录用户 ID | 全局，不隔离 |
| `agent_memory_store_{userId}` | 记忆系统 | 按用户 |
| `chat_history_{userId}` | 聊天历史 | 按用户 |
| `ui_state_{userId}` | UI 偏好 (theme 等) | 按用户 |

## 聊天历史结构

```ts
interface ChatHistory {
  messages: Message[];       // 完整消息列表
  activePluginId: string;    // 当前选中插件
  lastActiveAt: number;      // 最后活跃时间戳
}
```

写入时机：
- 新消息添加后 debounce 500ms 写入
- 切换插件时写入
- 退出登录时写入

## 登录页 UI

独立组件 `LoginScreen.tsx`，未登录时替换整个 App 内容。

- 2x2 网格展示用户卡片
- 点击卡片即登录（无密码）
- 墨韵设计系统风格

Header 改动：
- 右侧新增当前用户头像 + 下拉菜单
- 下拉菜单包含用户名和"退出登录"

## 用户切换流程

```
退出登录:
  保存当前数据 → 清除 current_user_id → 重置 Hook → 显示登录页

登录:
  写入 current_user_id → 加载用户数据 → 渲染主界面
```

React 层面：通过 `key={userId}` 挂载主界面，利用 key 机制自动重置所有 Hook 状态。

## 文件变更

### 新增 (3)

| 文件 | 职责 |
|------|------|
| `src/client/data/users.ts` | 用户列表 + MockUser 类型 |
| `src/client/hooks/useAuth.ts` | 登录状态管理 |
| `src/client/components/auth/LoginScreen.tsx` | 登录页 UI |

### 修改 (5)

| 文件 | 改动 |
|------|------|
| `src/client/hooks/useMemory.ts` | localStorage key 参数化 userId |
| `src/client/hooks/useAgent.ts` | 新增聊天历史持久化 |
| `src/client/components/layout/ThemeToggle.tsx` | 主题迁移到 ui_state_{userId} |
| `src/client/components/layout/Header.tsx` | 用户头像 + 退出下拉 |
| `src/App.tsx` | 整合 useAuth，条件渲染，key 重置 |

### 不改动

- 后端 (`server/`, `agent/`, `plugins/`, `shared/`) — 零改动
- `src/App.css` — 仅新增登录页样式
