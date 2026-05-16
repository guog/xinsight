# PRD：xinsight 核心重构 - 自定义角色 Agent 与数据源管理

## Executive Summary

**One-liner:** 实现系统管理员在后台自助配置角色化 Agent、挂载业务数据源与专属知识库，并通过统一对话入口由 Supervisor 路由意图，解决多系统数据查询与业务问答问题。

**Overview:**
这是一个核心架构重构项目，旨在将现有的静态 Agent 架构升级为基于 Supervisor + Workers 的动态路由模式。通过引入自定义角色 Agent 和统一的业务数据源管理（OpenAPI），系统将能更灵活地适应不同企业的特定业务场景（如设备管理、采购等）。项目采用分阶段交付策略，第一阶段聚焦基础后台和核心路由链路的跑通。

**Quick Facts:**

- **Target Users:** 系统管理员（配置） & 终端用户（使用）
- **Problem Solved:** 当前系统难以低成本接入多系统数据源并按角色组织能力
- **Key Metric:** Supervisor 意图路由准确率 & 数据源接入配置时间
- **Target Launch:** Phase 1 (MVP) ASAP

---

## 1. Problem Statement

目前系统的 Agent 是静态或半静态的，当面临企业复杂的内部系统集成（ERP, CRM 等）和细分的业务角色（设备管理员、质检员）时，缺乏统一、灵活的后台配置能力。终端用户面临需要在不同能力/角色间手动切换的体验摩擦。

---

## 2. Goals & Objectives

### Business Goals

1. 降低企业级私有化部署实施交付时的定制化开发成本（配置代替开发）。
2. 提供统一的对话入口（单一对话框），提升终端用户体验。

### User Goals

1. **管理员**：通过直观的界面导入 OpenAPI，组装针对特定角色的 Agent。
2. **终端用户**：直接自然语言提问，系统自动找到对应的业务数据或内置能力来回答。

---

## 3. User Personas

### 系统管理员

负责系统的安装、对接和维护。需要高效的 API 对接工具和 Agent 配置界面。

### 终端业务人员

日常使用系统查询数据、生成报告的普通员工。不关心背后是哪个大模型或哪个 Agent，只关心“我问的问题能否准确回答”。

---

## 4. User Stories & Requirements

### Epic: 统一交互与核心路由 (Supervisor)

- **User Story 1:** 作为终端用户，我希望只有一个对话框，这样我不需要去猜测哪个问题该问哪个 Agent。
- **User Story 2:** 作为架构，Supervisor 必须能够进行跨 Agent 的指代消解，以支持复杂的连续提问。
- **User Story 3:** 作为终端用户，我希望能够对回答进行点赞/踩反馈。

### Epic: 数据源与知识库管理

- **User Story 4:** 作为系统管理员，我希望能够通过导入 OpenAPI spec 文件快速注册业务系统接口，目前仅需支持 Read 操作。
- **User Story 5:** 作为系统管理员，我希望能够管理知识库，支持本地文档上传和在线图文编辑两种方式。

### Epic: Agent 配置组装

- **User Story 6:** 作为系统管理员，我希望能够创建自定义的业务角色 Agent（如设备 Agent），为其配置 Prompt。
- **User Story 7:** 作为系统管理员，我希望能够精确勾选已导入数据源中的特定 Endpoint 给特定的业务角色 Agent 使用。
- **User Story 8:** 作为系统管理员，我希望能够为特定业务角色 Agent 挂载专有的知识库分区。
- **User Story 9:** 作为系统管理员，我希望能查看系统内置的 8 项核心能力 Agent，但不能修改它们。

---

## 5. Success Metrics

- **Primary Metric:** Supervisor 路由成功率（用户意图被准确分发给目标 Agent 的比例，目标 > 95%）。
- **Secondary Metrics:**
  - 单个新数据源（OpenAPI）接入并完成配置的平均时间（目标 < 30 分钟）。
  - 用户反馈好评率。

---

## 6. Scope

### In Scope (Phase 1 MVP)

- Supervisor 路由调度跑通
- 基础管理后台：数据源导入管理 + Agent 角色配置与组装
- 8 项内置基础能力 Agent 就绪
- 统一交互界面与简单反馈

### Phase 2

- 知识库分类分区挂载功能
- 用户反馈看板与运营数据统计

### Out of Scope (Phase 1)

- 数据源写操作支持 (留到 Phase 3)
- 复杂工作流可视化编排
- 细粒度的 Agent 团队可见性权限控制

---

## 7. Technical Considerations

- **Architecture:** Supervisor 路由分发模式 (基于 Mastra 动态工具和 Supervisor Agent 模式重构)。
- **Data Source:** 使用 OpenAPI 解析，需要确保能处理并映射到 Mastra 工具的入参 (Schema)。
- **Dynamic Tool Registration:** 需使用 `activeTools` 机制来在 chat route 过滤特定的数据源 endpoints，避免给大模型注入过多无关工具导致调用不稳定（特别是对于 DeepSeek 模型超过 20+ 工具时的限制）。
- **Knowledge Base:** 继续基于 Karpathy 的 LLM Wiki 原理，通过结构化 Markdown 和关键词搜索实现。

---

## 8. Timeline & Milestones

- **Phase 1 (MVP)**: 核心路由与基础管理后台。
- **Phase 2**: 知识库分类挂载与运营统计。
- **Phase 3**: 远期规划落实。
