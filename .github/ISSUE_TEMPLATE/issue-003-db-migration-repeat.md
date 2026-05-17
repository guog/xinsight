---
title: "数据库迁移在开发模式下重复执行"
labels: ["enhancement", "ai:trae"]
---

## 问题描述
每次启动开发服务器时，都会尝试执行数据库迁移：

```
$ bun scripts/db-push.ts
✓ 0000_parallel_sebastian_shaw.sql
...
数据库初始化完成，共 15 张表...
```

## 影响
- 降低开发体验
- 日志噪音
- 启动速度变慢

## 建议
考虑添加迁移锁定机制或检查机制，避免重复迁移。
