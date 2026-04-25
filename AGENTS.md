# AGENTS.md — xinsight

基于 Bun + TypeScript + Next.js + Mastra + Vercel AI Elements 的多 Agent AI 应用。
兼容主流大模型厂商（DeepSeek、阿里通义千问、OpenAI、Anthropic、Google 等）。

> 开发命令、目录结构、环境变量、开发流程等详见 @docs/CONTRIBUTING.md

## 技术栈

- **运行时 / 包管理器：** Bun（`bun install`、`bun run`、`bunx`）
- **前端框架：** Next.js 16（App Router + Turbopack）
- **AI Agent 与工作流：** Mastra framework（库模式，集成在 Next.js API Routes 中）
- **AI SDK：** Vercel AI SDK v6 + `@mastra/ai-sdk`（流式桥接）
- **UI 组件：** Vercel AI Elements（基于 shadcn/ui，安装到 `@/components/ai-elements/`）
- **语言：** 全栈 TypeScript

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
- Mastra API 变化快——写代码前必须核对内嵌文档（`node_modules/@mastra/*/dist/docs/`）或远程文档（`https://mastra.ai/llms.txt`），不要信任训练数据
- 模型格式为 `provider/model-name`（如 `deepseek/deepseek-chat`）。运行 `node skills/mastra/scripts/provider-registry.mjs` 查看可用 provider 和模型
- 安装 AI Elements 组件：`bunx --bun shadcn@latest add "https://elements.ai-sdk.dev/api/registry/<component>.json"`
- `src/components/ui/` 和 `src/components/ai-elements/` 由 CLI 生成，可自定义但不要手动创建新文件到这些目录

## 已安装的 OpenCode Skills

| Skill         | 用途                                                      | 触发场景         |
| ------------- | --------------------------------------------------------- | ---------------- |
| `mastra`      | Mastra 框架指南、API 查询、Agent/Workflow 模式            | 任何 Mastra 开发 |
| `ai-elements` | AI 聊天 UI 组件（conversation、message、prompt-input 等） | 构建 AI 聊天界面 |

`skills/` 目录是指向 `.agents/skills/` 的符号链接，请勿直接编辑 skill 文件。
