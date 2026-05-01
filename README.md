# xinsight — AI Insight Assistant

<p align="center">
  <strong>Multi-Agent AI application for intelligent data querying and analysis</strong>
</p>

<p align="center">
  <a href="./README.zh-CN.md">中文文档</a> •
  <a href="./docs/CONTRIBUTING.md">Contributing Guide</a>
</p>

---

## Overview

**xinsight** is a multi-Agent AI chat application built with Bun, TypeScript, Next.js, and [Mastra](https://mastra.ai/). It connects to diverse data sources (REST APIs, GraphQL, gRPC, MQTT, OPC UA) and uses AI Agents to intelligently query, analyze, and present insights from your data.

### Key Features

- 🤖 **Multi-Agent System** — Chat Agent, Research Agent, Code Agent with specialized capabilities
- 🔌 **Universal Data Source Adapters** — REST, GraphQL, gRPC, MQTT, OPC UA out of the box
- 🧠 **AI-Powered Querying** — Agents understand natural language and translate to data source queries
- 🎨 **Modern Chat UI** — Built with Vercel AI Elements (shadcn/ui based), streaming responses
- 🌍 **Multi-Model Support** — DeepSeek, OpenAI, Anthropic, Google Gemini, Alibaba Qwen
- 📱 **Cross-Platform Ready** — Web, Tauri desktop, Capacitor mobile (via static export)

## Tech Stack

| Layer                     | Technology                                                    |
| ------------------------- | ------------------------------------------------------------- |
| Runtime & Package Manager | [Bun](https://bun.sh/)                                        |
| Frontend                  | [Next.js 16](https://nextjs.org/) (App Router + Turbopack)    |
| AI Framework              | [Mastra](https://mastra.ai/) (library mode)                   |
| AI SDK                    | [Vercel AI SDK v6](https://ai-sdk.dev/) + `@mastra/ai-sdk`    |
| UI Components             | [AI Elements](https://elements.ai-sdk.dev/) (shadcn/ui based) |
| Database                  | bun:sqlite + [Drizzle ORM](https://orm.drizzle.team/)         |
| Language                  | TypeScript (full-stack)                                       |

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) >= 1.1
- Node.js >= 20
- Git

### Setup

```bash
# Clone the repository
git clone https://github.com/guog/xinsight.git
cd xinsight

# Install dependencies
bun install

# Configure environment variables
cp .env.example .env.local
# Edit .env.local — at minimum, set DEEPSEEK_API_KEY

# Initialize the database
bun run db:push

# Start the development server
bun run dev
# Open http://localhost:3000
```

### Default Accounts

The system automatically seeds two users on first startup:

| Username | Password    | Role  | Description                    |
| -------- | ----------- | ----- | ------------------------------ |
| admin    | xinsight123 | admin | Full administrative privileges |
| guest    | xinsight123 | user  | Read-only / standard user      |

> Change passwords after first login.

### Environment Variables

| Variable                       | Required | Description                      |
| ------------------------------ | -------- | -------------------------------- |
| `DEEPSEEK_API_KEY`             | ✅       | DeepSeek API key (default model) |
| `DASHSCOPE_API_KEY`            | Optional | Alibaba Qwen API key             |
| `OPENAI_API_KEY`               | Optional | OpenAI API key                   |
| `ANTHROPIC_API_KEY`            | Optional | Anthropic API key                |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Optional | Google Gemini API key            |
| `AI_GATEWAY_API_KEY`           | Optional | Vercel AI Gateway key            |

## Project Structure

```
src/
├── app/                        # Next.js App Router
│   ├── page.tsx                # Chat interface (home)
│   ├── settings/               # Settings page
│   ├── admin/datasources/      # Data source management UI
│   └── api/                    # API Routes
│       ├── agents/             # GET /api/agents
│       ├── chat/               # POST /api/chat (streaming)
│       └── datasources/        # CRUD /api/datasources
├── components/
│   ├── ui/                     # shadcn/ui components (CLI managed)
│   └── ai-elements/            # AI Elements components (CLI managed)
├── db/
│   ├── schema.ts               # Drizzle schema
│   ├── index.ts                # Database connection
│   └── repositories/           # Data access layer
├── mastra/
│   ├── index.ts                # Mastra instance
│   ├── agents/                 # Agent definitions
│   └── tools/
│       └── datasource/         # Data source tools & adapters
│           └── adapters/       # REST, GraphQL, gRPC, MQTT, OPC UA
├── hooks/                      # React hooks
└── lib/                        # Utilities
```

## Available Scripts

| Command              | Description                   |
| -------------------- | ----------------------------- |
| `bun run dev`        | Start dev server (Turbopack)  |
| `bun run build`      | Production build              |
| `bun run start`      | Start production server       |
| `bun run db:push`    | Initialize / migrate database |
| `bun run test`       | Run tests                     |
| `bun run test:watch` | Tests in watch mode           |
| `bun run lint`       | ESLint check                  |
| `bun run lint:fix`   | ESLint auto-fix               |
| `bun run format`     | Prettier format               |
| `bun run typecheck`  | TypeScript type check         |
| `bun run mastra:dev` | Mastra Studio (:4111)         |

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Browser (Chat UI)                 │
│         AI Elements + useChat() streaming           │
└──────────────────────┬──────────────────────────────┘
                       │ POST /api/chat
┌──────────────────────▼──────────────────────────────┐
│                 Next.js API Routes                  │
│     mastra.getAgent() → agent.stream()              │
│     → toAISdkStream() → createUIMessageStreamResponse│
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│              Mastra Agents + Tools                  │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│   │Chat Agent│ │Research  │ │Code Agent│          │
│   └────┬─────┘ └────┬─────┘ └────┬─────┘          │
│        └─────────────┼───────────┘                  │
│                      │ datasource-query tool        │
│   ┌─────────────────▼────────────────────┐         │
│   │        Data Source Adapters           │         │
│   │  REST │ GraphQL │ gRPC │ MQTT │ OPCUA│         │
│   └───────────────────────────────────────┘         │
└─────────────────────────────────────────────────────┘
```

## Contributing

See [CONTRIBUTING.md](./docs/CONTRIBUTING.md) for development workflow, coding conventions, and TDD requirements.

## License

MIT
