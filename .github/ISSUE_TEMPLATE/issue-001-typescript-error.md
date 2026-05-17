---
title: "TypeScript 编译错误: agent-repository.ts Property 'changes' does not exist"
labels: ["bug", "ai:trae"]
---

## 问题描述
TypeScript 编译失败，报错信息：

```
src/db/repositories/agent-repository.ts(127,19): error TS2339: Property 'changes' does not exist on type 'void'.
```

## 复现步骤
1. 运行 `bun run typecheck`
2. 观察上述编译错误

## 期望行为
TypeScript 应该成功编译，没有类型错误。

## 环境信息
- bun version: 1.2.14
- TypeScript version: 6.0.3

## 相关代码位置
`src/db/repositories/agent-repository.ts` 第 127 行
