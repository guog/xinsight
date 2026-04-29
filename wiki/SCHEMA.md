# Wiki Schema

## Domain

工业数据洞察知识库 — 存储和管理用户上传的业务文档、数据字典、工艺说明等背景知识。

## Conventions

- 文件名: 小写、连字符、无空格 (e.g., `production-line-a1.md`)
- 每个 wiki 页面以 YAML frontmatter 开头
- 使用 `[[wikilinks]]` 在页面间建立关联（每页至少 2 个出站链接）
- 更新页面时必须更新 `updated` 日期
- 每个新页面必须添加到 `index.md`
- 每个操作必须追加到 `log.md`

## Frontmatter

```yaml
---
title: 页面标题
created: YYYY-MM-DD
updated: YYYY-MM-DD
type: entity | concept | comparison | query | summary
tags: [从下方分类中选择]
sources: [raw/uploads/source-file.md]
confidence: high | medium | low
---
```

## Tag Taxonomy

- 设备: equipment, sensor, plc, robot
- 工艺: process, recipe, parameter, quality
- 组织: department, role, supplier, customer
- 数据: metric, kpi, report, dashboard
- 系统: mes, erp, scada, wms
- 产品: product, material, bom, inventory

## Page Thresholds

- 创建页面: 实体/概念在 2+ 来源中出现，或在一个来源中是核心主题
- 更新页面: 新来源提及已有页面覆盖的内容
- 拆分页面: 超过 200 行时拆分为子主题
