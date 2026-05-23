# 远程办公申请自动化审批 Agent

基于 [Pi Agent Framework](https://github.com/earendil-works/pi) (53k ⭐) + DeepSeek V4 Pro 的智能审批助手。

## 架构

```
用户 → CLI / Web UI → Pi Agent 自主决策 → Tool 调用 → Mock API
                     ↑                    ↑
              Human-in-the-Loop     确认卡点 ×2
```

## 快速开始

```bash
npm install
```

### CLI 模式

```bash
npx tsx src/index.ts
```

### Web UI 模式

```bash
npm run web
# 打开 http://localhost:3000
```

## Provider

DeepSeek (Pi 内置)，环境变量 `DEEPSEEK_API_KEY`。

## 测试

```bash
npx vitest run
```

## 设计文档

[docs/DESIGN.md](docs/DESIGN.md) — 完整架构图 + Human-in-the-Loop 序列图。
