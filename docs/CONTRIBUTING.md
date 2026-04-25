# 贡献指南

感谢你对 xinsight 的关注！本文档将帮助你快速上手参与开发。

## 前置要求

- [Bun](https://bun.sh/) >= 1.1（运行时 & 包管理器，**禁止使用 npm / yarn**）
- Node.js >= 20
- Git

## 快速开始

```bash
# 1. Fork 并克隆仓库
git clone https://github.com/<你的用户名>/xinsight.git
cd xinsight

# 2. 安装依赖
bun install

# 3. 配置环境变量
cp .env.example .env.local
# 编辑 .env.local，至少填入 DEEPSEEK_API_KEY

# 4. 启动开发服务器
bun dev
# 访问 http://localhost:3000
```

## 常用命令

| 命令                 | 说明                        |
| -------------------- | --------------------------- |
| `bun dev`            | 启动开发服务器（Turbopack） |
| `bun run build`      | 生产构建                    |
| `bun run test`       | 运行测试（Vitest）          |
| `bun run test:watch` | 测试监听模式                |
| `bun run lint`       | ESLint 检查                 |
| `bun run lint:fix`   | ESLint 自动修复             |
| `bun run format`     | Prettier 格式化             |
| `bun run typecheck`  | TypeScript 类型检查         |
| `bun run mastra:dev` | 启动 Mastra Studio（:4111） |

## 目录结构

```
src/
  app/                  # Next.js App Router 页面与 API Routes
  components/
    ui/                 # shadcn/ui 组件（CLI 管理，勿手动新增）
    ai-elements/        # AI Elements 组件（CLI 管理，勿手动新增）
  lib/                  # 工具函数
  mastra/
    index.ts            # Mastra 入口
    agents/             # Agent 定义
    tools/              # Tool 定义
```

## 开发流程

### 1. 创建分支

基于 `main` 分支创建功能分支：

```bash
git checkout -b feat/你的功能名
```

### 2. 测试驱动开发（TDD）

本项目**强制 TDD**，所有功能开发必须遵循：

1. **红灯** — 先写一个会失败的测试
2. **绿灯** — 写最少的代码让测试通过
3. **重构** — 优化代码，确保测试仍然通过

```bash
# 监听模式开发
bun run test:watch
```

### 3. 代码规范

- **无分号**：已通过 Prettier `"semi": false` 强制
- **语言**：注释、UI 文案、commit message 均使用**中文**
- **LLM 密钥**：放在 `.env.local`，绝不提交
- 提交前会自动运行 lint-staged（Prettier + ESLint）和 commitlint

### 4. Commit 规范

遵循 [Conventional Commits](https://www.conventionalcommits.org/)，subject 允许中文。Header 最长 120 字符。

```
feat: 添加用户历史对话列表
fix: 修复流式响应中断问题
docs: 更新贡献指南
refactor: 重构 Agent 注册逻辑
test: 补充聊天 API 单元测试
```

### 5. 提交 Pull Request

1. 确保所有检查通过：
   ```bash
   bun run lint
   bun run typecheck
   bun run test
   ```
2. 推送分支并在 GitHub 上创建 PR
3. 在 PR 描述中说明变更内容和动机

## Mastra 开发注意事项

- Mastra 以**库模式**运行，集成在 Next.js API Routes 中，不独立部署
- API 变化快——写代码前必须核对 `node_modules/@mastra/*/dist/docs/` 或 [mastra.ai/llms.txt](https://mastra.ai/llms.txt)，**不要信任训练数据**
- 模型格式：`provider/model-name`（如 `deepseek/deepseek-chat`）
- 新建或修改 Agent 时须配置 `@mastra/evals` scorer（如 relevancy、toxicity、hallucination）

## UI 组件开发

- `src/components/ui/` 和 `src/components/ai-elements/` 由 CLI 生成
- 安装 AI Elements 组件：
  ```bash
  bunx --bun shadcn@latest add "https://elements.ai-sdk.dev/api/registry/<component>.json"
  ```
- 可自定义已有组件，但**不要手动新增文件**到这些目录

## 许可证

本项目基于 [MIT License](../LICENSE) 开源。提交代码即表示你同意以相同许可证授权你的贡献。
