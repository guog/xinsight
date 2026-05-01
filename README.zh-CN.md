# xinsight — AI 洞察助手

<p align="center">
  <strong>基于多 Agent 的 AI 智能数据查询与分析应用</strong>
</p>

<p align="center">
  <a href="./README.md">English</a> •
  <a href="./docs/CONTRIBUTING.md">贡献指南</a>
</p>

---

## 简介

**xinsight** 是一款基于 Bun + TypeScript + Next.js + [Mastra](https://mastra.ai/) 构建的多 Agent AI 聊天应用。它能够连接多种数据源（REST API、GraphQL、gRPC、MQTT、OPC UA），通过 AI Agent 进行智能查询、分析并呈现数据洞察。

### 核心特性

- 🤖 **多 Agent 系统** — 聊天助手、研究助手、代码助手，各司其职
- 🔌 **通用数据源适配器** — 内置 REST、GraphQL、gRPC、MQTT、OPC UA 支持
- 🧠 **AI 驱动查询** — Agent 理解自然语言，自动转换为数据源查询
- 🎨 **现代聊天界面** — 基于 Vercel AI Elements（shadcn/ui），支持流式响应
- 🌍 **多模型支持** — DeepSeek、OpenAI、Anthropic、Google Gemini、阿里通义千问
- 📱 **跨平台就绪** — Web、Tauri 桌面端、Capacitor 移动端（静态导出模式）

## 技术栈

| 层级              | 技术                                                          |
| ----------------- | ------------------------------------------------------------- |
| 运行时 & 包管理器 | [Bun](https://bun.sh/)                                        |
| 前端框架          | [Next.js 16](https://nextjs.org/)（App Router + Turbopack）   |
| AI 框架           | [Mastra](https://mastra.ai/)（库模式，集成在 Next.js 中）     |
| AI SDK            | [Vercel AI SDK v6](https://ai-sdk.dev/) + `@mastra/ai-sdk`    |
| UI 组件           | [AI Elements](https://elements.ai-sdk.dev/)（基于 shadcn/ui） |
| 数据库            | bun:sqlite + [Drizzle ORM](https://orm.drizzle.team/)         |
| 语言              | TypeScript（全栈）                                            |

## 快速开始

### 前置要求

- [Bun](https://bun.sh/) >= 1.1
- Node.js >= 20
- Git

### 安装与启动

```bash
# 克隆仓库
git clone https://github.com/guog/xinsight.git
cd xinsight

# 安装依赖
bun install

# 配置环境变量
cp .env.example .env.local
# 编辑 .env.local，至少填入 DEEPSEEK_API_KEY

# 初始化数据库
bun run db:push

# 启动开发服务器
bun run dev
# 打开 http://localhost:3000
```

### 预置账号

系统首次启动时自动创建以下用户（幂等，已存在则跳过）：

| 用户名 | 密码        | 角色  | 说明                     |
| ------ | ----------- | ----- | ------------------------ |
| admin  | xinsight123 | admin | 管理员，拥有全部权限     |
| guest  | xinsight123 | user  | 访客，仅拥有普通用户权限 |

> 首次登录后请及时修改密码。

### 环境变量说明

| 变量名                         | 必需 | 说明                          |
| ------------------------------ | ---- | ----------------------------- |
| `DEEPSEEK_API_KEY`             | ✅   | DeepSeek API 密钥（默认模型） |
| `DASHSCOPE_API_KEY`            | 可选 | 阿里通义千问 API 密钥         |
| `OPENAI_API_KEY`               | 可选 | OpenAI API 密钥               |
| `ANTHROPIC_API_KEY`            | 可选 | Anthropic API 密钥            |
| `GOOGLE_GENERATIVE_AI_API_KEY` | 可选 | Google Gemini API 密钥        |
| `AI_GATEWAY_API_KEY`           | 可选 | Vercel AI Gateway 密钥        |

## 项目结构

```
src/
├── app/                        # Next.js App Router
│   ├── page.tsx                # 聊天界面（首页）
│   ├── settings/               # 设置页面
│   ├── admin/datasources/      # 数据源管理界面
│   └── api/                    # API 路由
│       ├── agents/             # GET /api/agents
│       ├── chat/               # POST /api/chat（流式）
│       └── datasources/        # CRUD /api/datasources
├── components/
│   ├── ui/                     # shadcn/ui 组件（CLI 管理）
│   └── ai-elements/            # AI Elements 组件（CLI 管理）
├── db/
│   ├── schema.ts               # Drizzle 数据库模型
│   ├── index.ts                # 数据库连接
│   └── repositories/           # 数据访问层
├── mastra/
│   ├── index.ts                # Mastra 实例
│   ├── agents/                 # Agent 定义
│   └── tools/
│       └── datasource/         # 数据源工具 & 适配器
│           └── adapters/       # REST、GraphQL、gRPC、MQTT、OPC UA
├── hooks/                      # React Hooks
└── lib/                        # 工具函数
```

## 常用命令

| 命令                 | 说明                        |
| -------------------- | --------------------------- |
| `bun run dev`        | 启动开发服务器（Turbopack） |
| `bun run build`      | 生产构建                    |
| `bun run start`      | 启动生产服务器              |
| `bun run db:push`    | 初始化 / 迁移数据库         |
| `bun run test`       | 运行测试                    |
| `bun run test:watch` | 测试监听模式                |
| `bun run lint`       | ESLint 检查                 |
| `bun run lint:fix`   | ESLint 自动修复             |
| `bun run format`     | Prettier 格式化             |
| `bun run typecheck`  | TypeScript 类型检查         |
| `bun run mastra:dev` | 启动 Mastra Studio（:4111） |

## 架构概览

```
┌─────────────────────────────────────────────────────┐
│                 浏览器（聊天界面）                    │
│         AI Elements + useChat() 流式通信             │
└──────────────────────┬──────────────────────────────┘
                       │ POST /api/chat
┌──────────────────────▼──────────────────────────────┐
│               Next.js API Routes                    │
│     mastra.getAgent() → agent.stream()              │
│     → toAISdkStream() → createUIMessageStreamResponse│
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│             Mastra Agents + Tools                   │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│   │ 聊天助手 │ │ 研究助手 │ │ 代码助手 │          │
│   └────┬─────┘ └────┬─────┘ └────┬─────┘          │
│        └─────────────┼───────────┘                  │
│                      │ datasource-query tool        │
│   ┌─────────────────▼────────────────────┐         │
│   │          数据源适配器                 │         │
│   │  REST │ GraphQL │ gRPC │ MQTT │ OPCUA│         │
│   └───────────────────────────────────────┘         │
└─────────────────────────────────────────────────────┘
```

## 参与贡献

详见 [CONTRIBUTING.md](./docs/CONTRIBUTING.md)，包含开发流程、编码规范和 TDD 要求。

## 许可证

MIT
