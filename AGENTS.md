# AGENTS.md — xinsight

基于 Bun + TypeScript + Next.js + Mastra + Vercel AI Elements 的多 Agent AI 应用。
兼容主流大模型厂商（DeepSeek、阿里通义千问、OpenAI、Anthropic、Google 等）。

> 开发命令、目录结构、环境变量、开发流程等详见 @docs/CONTRIBUTING.md

## 技术栈

- **运行时 / 包管理器：** Bun（`bun install`、`bun run`、`bunx`）
- **前端框架：** Next.js 16（App Router + Turbopack）
- **AI Agent 与工作流：** Mastra framework（库模式，集成在 Next.js API Routes 中）
- **AI SDK：** Vercel AI SDK v6 + `@ai-sdk/react` v3 + `@mastra/ai-sdk`（流式桥接）
- **UI 组件：** Vercel AI Elements + shadcn/ui v4（安装到 `@/components/ai-elements/` 和 `@/components/ui/`）
- **数据库：** Drizzle ORM + LibSQL（`src/db/`），Mastra Memory 使用独立 LibSQL 存储
- **类型校验：** Zod v4（注意与 v3 有破坏性变更）
- **样式：** Tailwind CSS v4
- **认证：** 自研 session 认证（bcrypt 密码哈希 + HMAC session 签名）
- **跨平台：** Tauri（桌面）+ Capacitor（iOS / Android）
- **语言：** 全栈 TypeScript

## 项目能力概述

- **14 个 Agent**：通用（chat、auto、wiki、research、code）+ 工业场景（energy、warehouse、production、equipment、quality、factory-director）
- **5 种数据源协议适配器**：REST、gRPC、GraphQL、MQTT、OPC-UA
- **语音交互**：TTS / STT（基于 DashScope）
- **管理后台**：Provider 管理、数据源管理、Agent 配置、Wiki 知识库
- **移动端适配**：独立移动端路由组（`/(mobile)/`）
- **Memory 增强**：Working Memory（跨会话用户画像）+ Semantic Recall（语义召回历史）+ 观察性记忆
- **可观测性**：Mastra Observability 本地 tracing（存储到 LibSQL）
- **MCP Server**：支持 Cursor / Claude Desktop 等 MCP 客户端直接调用 xinsight 工具（`bun run mcp:stdio`）

## 核心约定

- **TDD 强制：始终采用测试驱动开发。** 红灯 → 绿灯 → 重构，不得跳过。测试框架使用 Vitest（`bun run test`）。
- **无分号：** 已通过 Prettier `"semi": false` 强制。
- **语言要求：优先使用中文。** 对话、代码注释、UI 文案、commit message 均使用中文，除非上下文明确要求英文。
- 所有命令使用 `bun`，禁止使用 `npm` 或 `yarn`
- LLM 密钥放在 `.env.local`（已 gitignore），禁止提交密钥
- Commit message 遵循 [Conventional Commits](https://www.conventionalcommits.org/)，subject 允许中文
- 提交前自动运行 lint-staged（Prettier + ESLint）和 commitlint

## 架构要点

- **Mastra 以库模式运行**：不独立部署 Mastra 服务器，直接在 Next.js API Routes 中调用 `mastra.getAgent()`
- **流式响应链路**：`agent.stream()` → `toAISdkStream()` → `createUIMessageStreamResponse()` → 前端 `useChat()`
- **Mastra Evals**：新建或修改 Agent 时须配置 `@mastra/evals` scorer（如 relevancy、toxicity、hallucination）
- **Memory 架构**：`@mastra/memory` + `@mastra/libsql`（LibSQLStore + LibSQLVector），嵌入使用 `@mastra/fastembed`（本地运行，无需 API key）
  - Working Memory：resource 级别跨线程持久化用户画像
  - Semantic Recall：向量搜索召回历史对话（topK=5）
  - 观察性记忆：自动从对话提取关键信息
- **可观测性**：`@mastra/observability`（MastraStorageExporter），traces 存储到本地 Storage DB（`data/storage.db`），可在 Mastra Studio 查看
- **MCP Server**：`src/mastra/mcp-server.ts`，以 stdio 模式暴露数据源工具，供 Cursor / Claude Desktop 调用
- **数据库层**：Drizzle ORM + LibSQL，`src/db/` 包含 schema 定义、迁移脚本、种子数据（预置 admin/guest 账号）
- **认证系统**：`/api/auth/`（登录/注册/登出/当前用户），基于 bcrypt + HMAC session，API key 使用 `ENCRYPTION_KEY` 加密存储
- **管理后台 API**：`/api/admin/providers/`（Provider CRUD + 模型同步）、`/api/datasources/`（数据源 CRUD + 连接测试 + 协议自发现）、`/api/wiki/admin/`（Wiki 任务管理）
- Mastra API 变化快——写代码前必须核对内嵌文档（`node_modules/@mastra/*/dist/docs/`）或远程文档（`https://mastra.ai/llms.txt`），不要信任训练数据
- 模型格式为 `provider/model-name`（如 `deepseek/deepseek-chat`）。运行 `node skills/mastra/scripts/provider-registry.mjs` 查看可用 provider 和模型
- 安装 AI Elements 组件：`bunx --bun shadcn@latest add "https://elements.ai-sdk.dev/api/registry/<component>.json"`
- `src/components/ui/` 和 `src/components/ai-elements/` 由 CLI 生成，可自定义但不要手动创建新文件到这些目录

## Git 分支工作流

> ⚠️ **Turbopack workspace root 陷阱**：如果项目上层目录（如 `~/`）存在 `package.json`、`pnpm-lock.yaml` 或 `pnpm-workspace.yaml`，Turbopack 会将上层目录误判为 workspace root，导致 `bun dev` 时 CPU 100% 卡死或 ChunkLoadError。解决方案：删除上层目录的这些文件，而非在 `next.config.ts` 中设置 `turbopack.root`（该配置本身会引发 chunk 路径错乱）。

- **禁止直接在 `main` 分支上修改代码。** 每次改动必须从 `main` 创建新分支后再开始。
- **分支命名：** `feat/<简短描述>` 或 `fix/<简短描述>`（如 `feat/add-chat-history`、`fix/stream-error-handling`）。描述使用英文短横线连接。
- **工作流程：**
  1. `git checkout main && git pull origin main`
  2. `git checkout -b feat/<描述>` 或 `git checkout -b fix/<描述>`
  3. 在分支上完成开发、测试、提交（遵循 Conventional Commits）
  4. `git push -u origin <分支名>`
  5. 通过 `gh pr create` 发起 Pull Request，填写清晰的摘要
  6. **合并 PR 时必须使用变基（rebase）**：`git checkout main && git pull origin main && git rebase <分支名> && git push origin main`，禁止使用 merge commit
  7. 合并后删除远程分支：`git push origin --delete <分支名> && git branch -d <分支名>`
- **PR 规范：** 标题遵循 Conventional Commits 格式，body 包含 `## Summary` + 要点列表
- **一个分支只做一件事：** 不要在同一分支混合不相关的改动

## Issue 驱动工作流

采用 **Tracking Issue + 子 Issue** 模式管理任务：

### 结构

- **Tracking Issue（跟踪总表）**：加 `tracking` 标签，body 中用 Task List（`- [ ] #子Issue`）关联所有子 Issue，GitHub 自动显示进度条
- **子 Issue**：每个子 Issue 对应一个可独立合并的改动，加对应的优先级和类型标签
- **一个子 Issue = 一个分支 = 一个 PR**

### 标签体系

| 标签                                            | 用途                         |
| ----------------------------------------------- | ---------------------------- |
| `tracking`                                      | 跟踪总表                     |
| `status/in-progress`                            | 进行中（占位，防止重复劳动） |
| `priority:critical` / `high` / `medium` / `low` | 优先级                       |
| `security`                                      | 安全相关                     |

### 工作流程

1. **领取任务**：给子 Issue 加 `status/in-progress` 标签
2. **开发**：按「Git 分支工作流」从 `main` 创建分支，开发并提交
3. **关键信息记录**：开发过程中的关键决策、发现、阻塞等记录为子 Issue 的评论
4. **发 PR**：PR body 中写 `Closes #子Issue`（合并后自动关闭子 Issue），同时写 `Part of #跟踪总表`（不自动关闭总表）
5. **完成**：子 Issue 关闭后，跟踪总表的 Task List 自动勾选。全部子 Issue 完成后手动关闭跟踪总表

### 注意事项

- 拆分子 Issue 时，相近的小改动可合并为一个（如多个输入校验合为一个 Issue）
- 安全问题优先修复，按依赖关系排序
- 不要在跟踪总表上直接开发，它只用于汇总和追踪进度

## 已安装的 OpenCode Skills

| Skill                         | 用途                                                      | 触发场景            |
| ----------------------------- | --------------------------------------------------------- | ------------------- |
| `agent-browser`               | 浏览器自动化（网页交互、表单填写、截图、数据抓取）        | 需要操作浏览器时    |
| `ai-elements`                 | AI 聊天 UI 组件（conversation、message、prompt-input 等） | 构建 AI 聊天界面    |
| `code-reviewer`               | 代码审查（本地变更或远程 PR）                             | 审查代码质量        |
| `frontend-design`             | 高质量前端界面设计与组件开发                              | 构建 Web 页面或组件 |
| `mastra`                      | Mastra 框架指南、API 查询、Agent/Workflow 模式            | 任何 Mastra 开发    |
| `pr-creator`                  | PR 创建辅助（标题、描述、关联 Issue）                     | 创建 Pull Request   |
| `prd-generator`               | 生成产品需求文档（PRD）                                   | 编写产品规格说明    |
| `vercel-react-best-practices` | React/Next.js 性能优化指南                                | 优化前端性能        |
| `web-design-guidelines`       | Web 设计规范审查（可访问性、UX）                          | 审查 UI 设计        |
| `webapp-testing`              | Web 应用测试（Playwright 交互、截图、日志）               | 测试前端功能        |

`skills/` 目录是指向 `.agents/skills/` 的符号链接，请勿直接编辑 skill 文件。

## Issue 完成与 PR 流程

完成一个 Issue 时，必须按以下顺序执行：

1. **自检验收项**：对照 Issue 中列出的验收标准逐条检查，确认全部满足
2. **更新验收项状态**：在 Issue 中勾选已完成的验收项（checkbox）
3. **发起 PR**：创建 Pull Request，关联 Issue
4. **立即执行测试计划**：PR 创建后，立刻运行 PR body 中列出的测试计划项（手动验证、自动测试等）
5. **更新测试计划状态**：测试完成后，即时编辑 PR body 勾选已通过的测试项
6. **提交审查评论**：每次审查完 PR 后，必须将所有的 PR 代码审查结果以评论形式提交到 PR 中（使用 `gh pr comment` 或 `gh pr review`），确保审查结论留痕可追溯，切勿仅在私聊或本地记录。同时，对于发送到 Issue 或 PR 中的正文内容或评论留言内容，其结尾始终要附带 AI Agent 的名称及所使用的大模型名称作为签名。
7. **发布 PR 修复总结时机**：在向 GitHub 仓库发送 PR 修复总结前，必须先提交并推送（git commit & push）最新的代码改动，确保 PR 中的代码是最新的，然后再发送修复总结。
