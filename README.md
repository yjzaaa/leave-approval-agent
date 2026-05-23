# 远程办公申请自动化审批 Agent (Pi Framework)

基于 [Pi Agent Framework](https://github.com/earendil-works/pi) (53k ⭐) 的智能审批助手。

## 架构

```
用户输入 → Pi Agent → 决策调用 Tool → 校验/提交/发起 → 返回结果
```

## 快速开始

```bash
npm install
cp .env.example .env   # 配置 OPENAI_API_KEY
npx tsx src/index.ts
```

## Provider 配置

默认使用智谱 GLM (zai provider)：

```env
OPENAI_API_KEY=your-zhipu-api-key
```

Pi 框架支持 30+ 提供商切换。

## 测试

```bash
npx vitest run
```
