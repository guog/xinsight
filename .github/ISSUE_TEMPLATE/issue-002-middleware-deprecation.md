---
title: "Next.js middleware 文件弃用警告"
labels: ["enhancement", "ai:trae"]
---

## 问题描述
应用启动时出现弃用警告：

```
⚠ The "middleware" file convention is deprecated. Please use "proxy" instead. Learn more: https://nextjs.org/docs/messages/middleware-to-proxy
Migration failed: Failed to run the query 'CREATE TABLE `agent_datasources`...
```

## 影响
- 影响开发体验，产生不必要的警告
- 可能影响未来 Next.js 版本的兼容性

## 建议
将 `middleware.ts` 迁移到 `proxy.ts`。

## 参考
- https://nextjs.org/docs/messages/middleware-to-proxy
