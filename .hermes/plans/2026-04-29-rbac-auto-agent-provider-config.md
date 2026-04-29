# RBAC + 自动助手 + 模型提供商环境变量配置 实施计划

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 实现角色权限控制（管理员/普通用户）、新增"自动"助手模式、模型提供商限制为国内（DeepSeek + 阿里）并通过环境变量驱动配置。

**Architecture:**

- 权限：在现有 auth 系统上添加 `requireAdmin()` 中间件，前端根据 role 隐藏管理入口
- 自动助手：新增 auto-agent，利用 LLM 意图分类路由到具体 agent
- 模型配置：用环境变量定义可用提供商和模型，替换现有硬编码静态注册表

**Tech Stack:** Next.js 16 + Bun + Mastra + Drizzle ORM + SQLite + Vercel AI SDK

---

## Phase 1: 环境变量驱动的模型提供商配置

### Task 1: 重写 `src/lib/models.ts` — 环境变量驱动的提供商注册表

**Objective:** 用环境变量替代硬编码的模型提供商列表，只有配置了 API Key 的提供商才可用。

**Files:**

- Modify: `src/lib/models.ts`
- Modify: `.env.example`
- Modify: `.env.local`

**Step 1: 更新 `.env.example`**

```env
# === 模型提供商配置 ===
# 可用提供商列表（逗号分隔），未配置 API Key 的会自动跳过
# 默认仅启用国内提供商，海外提供商需显式添加
LLM_PROVIDERS=deepseek,qwen

# DeepSeek
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_MODELS=deepseek-chat,deepseek-reasoner

# 阿里云百炼 (Qwen)
DASHSCOPE_API_KEY=
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
QWEN_MODELS=qwen-max,qwen-plus,qwen-turbo,qwq-max

# === 海外提供商（默认不启用，需在 LLM_PROVIDERS 中添加）===
# OPENAI_API_KEY=
# OPENAI_BASE_URL=https://api.openai.com/v1
# OPENAI_MODELS=gpt-4o,gpt-4o-mini

# ANTHROPIC_API_KEY=
# ANTHROPIC_BASE_URL=https://api.anthropic.com/v1
# ANTHROPIC_MODELS=claude-sonnet-4-20250514
```

**Step 2: 重写 `src/lib/models.ts`**

核心逻辑：

1. 定义 `ProviderConfig` 接口：`{ id, name, envKeyVar, envBaseUrlVar, envModelsVar, defaultBaseUrl, defaultModels }`
2. 内置提供商元数据（deepseek, qwen, openai, anthropic 等），包含默认 URL 和默认模型列表
3. `getAvailableProviders()`: 读取 `LLM_PROVIDERS` 环境变量，过滤出有 API Key 的提供商
4. `getAvailableModels()`: 对每个可用提供商，读取 `*_MODELS` 环境变量（或用默认列表），生成 `{id: "provider/model", name, providerId}` 列表
5. `getDefaultModelId()`: 返回第一个可用模型
6. `getModelById(id)`: 从可用模型中查找
7. `getProviderConfig(providerId)`: 返回 baseUrl + apiKey，供 Mastra agent 使用

```typescript
// src/lib/models.ts

export interface Provider {
  id: string
  name: string
  apiKey: string
  baseUrl: string
  models: Model[]
}

export interface Model {
  id: string // "deepseek/deepseek-chat"
  name: string // "DeepSeek Chat"
  providerId: string // "deepseek"
  modelSlug: string // "deepseek-chat" (不含 provider 前缀)
}

interface ProviderMeta {
  id: string
  name: string
  envKeyVar: string
  envBaseUrlVar: string
  envModelsVar: string
  defaultBaseUrl: string
  defaultModels: { slug: string; name: string }[]
}

const PROVIDER_REGISTRY: ProviderMeta[] = [
  {
    id: "deepseek",
    name: "DeepSeek",
    envKeyVar: "DEEPSEEK_API_KEY",
    envBaseUrlVar: "DEEPSEEK_BASE_URL",
    envModelsVar: "DEEPSEEK_MODELS",
    defaultBaseUrl: "https://api.deepseek.com/v1",
    defaultModels: [
      { slug: "deepseek-chat", name: "DeepSeek Chat" },
      { slug: "deepseek-reasoner", name: "DeepSeek Reasoner" },
    ],
  },
  {
    id: "qwen",
    name: "阿里云百炼 (Qwen)",
    envKeyVar: "DASHSCOPE_API_KEY",
    envBaseUrlVar: "QWEN_BASE_URL",
    envModelsVar: "QWEN_MODELS",
    defaultBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultModels: [
      { slug: "qwen-max", name: "Qwen Max" },
      { slug: "qwen-plus", name: "Qwen Plus" },
      { slug: "qwen-turbo", name: "Qwen Turbo" },
      { slug: "qwq-max", name: "QwQ Max (推理)" },
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    envKeyVar: "OPENAI_API_KEY",
    envBaseUrlVar: "OPENAI_BASE_URL",
    envModelsVar: "OPENAI_MODELS",
    defaultBaseUrl: "https://api.openai.com/v1",
    defaultModels: [
      { slug: "gpt-4o", name: "GPT-4o" },
      { slug: "gpt-4o-mini", name: "GPT-4o Mini" },
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    envKeyVar: "ANTHROPIC_API_KEY",
    envBaseUrlVar: "ANTHROPIC_BASE_URL",
    envModelsVar: "ANTHROPIC_MODELS",
    defaultBaseUrl: "https://api.anthropic.com/v1",
    defaultModels: [{ slug: "claude-sonnet-4-20250514", name: "Claude Sonnet 4" }],
  },
]

// 缓存
let _providers: Provider[] | null = null

function parseProviders(): Provider[] {
  const enabledIds = (process.env.LLM_PROVIDERS || "deepseek,qwen")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)

  return enabledIds
    .map((id) => PROVIDER_REGISTRY.find((p) => p.id === id))
    .filter((meta): meta is ProviderMeta => !!meta)
    .filter((meta) => !!process.env[meta.envKeyVar]) // 必须有 API Key
    .map((meta) => {
      const apiKey = process.env[meta.envKeyVar]!
      const baseUrl = process.env[meta.envBaseUrlVar] || meta.defaultBaseUrl
      const modelSlugs = process.env[meta.envModelsVar]
        ? process.env[meta.envModelsVar]!.split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : meta.defaultModels.map((m) => m.slug)

      const models: Model[] = modelSlugs.map((slug) => {
        const defaultModel = meta.defaultModels.find((m) => m.slug === slug)
        return {
          id: `${meta.id}/${slug}`,
          name: defaultModel?.name || slug,
          providerId: meta.id,
          modelSlug: slug,
        }
      })

      return { id: meta.id, name: meta.name, apiKey, baseUrl, models }
    })
}

export function getProviders(): Provider[] {
  if (!_providers) _providers = parseProviders()
  return _providers
}

export function getModels(): Model[] {
  return getProviders().flatMap((p) => p.models)
}

export function getModelById(id: string): Model | undefined {
  return getModels().find((m) => m.id === id)
}

export function getDefaultModelId(): string {
  const models = getModels()
  return models[0]?.id || "deepseek/deepseek-chat"
}

export function getProviderForModel(modelId: string): Provider | undefined {
  const model = getModelById(modelId)
  if (!model) return undefined
  return getProviders().find((p) => p.id === model.providerId)
}
```

**Step 3: 更新 `.env.local`**

添加 `LLM_PROVIDERS=deepseek`（当前只有 deepseek key）。

**Step 4: 验证**

Run: `cd ~/xinsight && bun run build`
Expected: 编译通过，无 import 错误

**Step 5: Commit**

```bash
git add src/lib/models.ts .env.example .env.local
git commit -m "feat: env-driven model provider registry

Replace hardcoded provider list with environment variable driven config.
Providers are only available when their API key is set.
Default: deepseek + qwen (domestic providers)."
```

---

### Task 2: 新增模型提供商 API 端点

**Objective:** 提供 `/api/models` 端点返回当前可用的提供商和模型列表，供前端使用。

**Files:**

- Create: `src/app/api/models/route.ts`

**Step 1: 创建 API 路由**

```typescript
// src/app/api/models/route.ts
import { getProviders, getModels, getDefaultModelId } from "@/lib/models"

export async function GET() {
  return Response.json({
    providers: getProviders().map((p) => ({
      id: p.id,
      name: p.name,
      models: p.models.map((m) => ({ id: m.id, name: m.name })),
    })),
    models: getModels().map((m) => ({ id: m.id, name: m.name, providerId: m.providerId })),
    defaultModelId: getDefaultModelId(),
  })
}
```

**Step 2: Commit**

```bash
git add src/app/api/models/route.ts
git commit -m "feat: add /api/models endpoint for available providers and models"
```

---

### Task 3: Agent 动态模型 — 让 `/api/chat` 使用客户端选择的模型

**Objective:** 修改 chat API，使用客户端传来的 `modelId` 动态创建 model 实例，而非使用 agent 硬编码的模型。

**Files:**

- Modify: `src/app/api/chat/route.ts`
- Modify: `src/mastra/agents/chat-agent.ts`
- Modify: `src/mastra/agents/research-agent.ts`
- Modify: `src/mastra/agents/code-agent.ts`

**Step 1: 修改 chat API route**

在 `route.ts` 中：

1. 从 body 中解构 `modelId`
2. 用 `getProviderForModel(modelId)` 获取提供商配置
3. 用 `createOpenAICompatible` 创建动态 model 实例（DeepSeek 和 Qwen 都兼容 OpenAI API）
4. 将 model 传给 agent 的 `stream()`/`generate()` 调用

关键代码：

```typescript
import { getProviderForModel, getModelById, getDefaultModelId } from "@/lib/models"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"

// 在 POST handler 中：
const { messages, agentId = "chatAgent", modelId } = await req.json()
const effectiveModelId = modelId || getDefaultModelId()
const provider = getProviderForModel(effectiveModelId)
const modelInfo = getModelById(effectiveModelId)

let modelInstance = undefined
if (provider && modelInfo) {
  const client = createOpenAICompatible({
    name: provider.id,
    baseURL: provider.baseUrl,
    apiKey: provider.apiKey,
  })
  modelInstance = client.chatModel(modelInfo.modelSlug)
}

// 传递给 agent stream
const result = await agent.stream(messages, { model: modelInstance })
```

**Step 2: 简化 agent 定义**

各 agent 文件中去掉硬编码的 `model` 字段，改为使用默认模型（作为 fallback）：

```typescript
// 从 model: 'deepseek/deepseek-chat' 改为动态传入
// agent 定义中保留一个 fallback model 或不设 model（由 API route 传入）
```

**Step 3: 验证**

Run: `cd ~/xinsight && bun run build`

**Step 4: Commit**

```bash
git add src/app/api/chat/route.ts src/mastra/agents/*.ts
git commit -m "feat: dynamic model selection in chat API

Chat API now accepts modelId from client and creates the appropriate
provider client at runtime. Agents no longer hardcode their model."
```

---

## Phase 2: 角色权限控制

### Task 4: 添加 `requireAdmin()` 权限检查

**Objective:** 在 auth 模块中添加 admin 权限校验函数。

**Files:**

- Modify: `src/lib/auth.ts`

**Step 1: 添加 requireAdmin 函数**

在 `requireAuth()` 之后添加：

```typescript
export async function requireAdmin() {
  const user = await requireAuth()
  if (user.role !== "admin") {
    throw new Error("Forbidden: admin access required")
  }
  return user
}
```

**Step 2: Commit**

```bash
git add src/lib/auth.ts
git commit -m "feat: add requireAdmin() auth helper"
```

---

### Task 5: API 路由添加 admin 权限保护

**Objective:** 所有管理类 API（数据源 CRUD、agent 数据源关联）要求 admin 权限。

**Files:**

- Modify: `src/app/api/datasources/route.ts` — POST 需要 admin
- Modify: `src/app/api/datasources/[id]/route.ts` — PUT/DELETE 需要 admin
- Modify: `src/app/api/datasources/[id]/test/route.ts` — POST 需要 admin
- Modify: `src/app/api/datasources/[id]/agents/route.ts` — POST/DELETE 需要 admin
- Modify: `src/app/api/agents/[id]/datasources/route.ts` — POST/DELETE 需要 admin

**Step 1: 在每个管理 API 的写操作中添加 admin 检查**

模式：

```typescript
import { requireAdmin } from "@/lib/auth"

export async function POST(req: Request) {
  try {
    await requireAdmin()
  } catch {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }
  // ... 原有逻辑
}
```

GET 操作保持仅需 `requireAuth()`（普通用户可以查看数据源列表用于对话）。

**Step 2: 验证**

Run: `cd ~/xinsight && bun run build`

**Step 3: Commit**

```bash
git add src/app/api/datasources/ src/app/api/agents/
git commit -m "feat: protect admin API routes with requireAdmin()

POST/PUT/DELETE on datasources and agent-datasource associations
now require admin role. GET remains accessible to all authenticated users."
```

---

### Task 6: 前端添加用户角色 context 和管理入口隐藏

**Objective:** 前端通过 `/api/auth/me` 获取用户角色，普通用户完全隐藏管理入口。

**Files:**

- Create: `src/hooks/use-user.ts` — 获取当前用户信息（含 role）的 hook
- Modify: `src/components/sidebar.tsx` — 根据 role 隐藏"数据源管理"入口
- Modify: `src/app/admin/layout.tsx` — 添加前端 role 检查，非 admin 重定向

**Step 1: 创建 `use-user.ts` hook**

```typescript
// src/hooks/use-user.ts
import { useState, useEffect } from "react"

interface User {
  id: string
  username: string
  displayName: string | null
  role: "admin" | "user"
}

export function useUser() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setUser(data?.user || null))
      .finally(() => setLoading(false))
  }, [])

  return { user, loading, isAdmin: user?.role === "admin" }
}
```

**Step 2: 修改 sidebar.tsx**

用 `useUser()` 获取角色，`isAdmin` 为 false 时不渲染"数据源管理"链接。

**Step 3: 修改 admin layout**

```typescript
// 在 admin/layout.tsx 中
const { isAdmin, loading } = useUser()
if (!loading && !isAdmin) {
  redirect("/") // 或 router.push('/')
}
```

**Step 4: Commit**

```bash
git add src/hooks/use-user.ts src/components/sidebar.tsx src/app/admin/layout.tsx
git commit -m "feat: hide admin UI for non-admin users

Add useUser() hook for role detection. Sidebar hides admin links
for regular users. Admin layout redirects non-admins."
```

---

### Task 7: `/api/auth/me` 返回用户角色

**Objective:** 确保 `/api/auth/me` 端点返回 `role` 字段。

**Files:**

- Modify: `src/app/api/auth/me/route.ts`

**Step 1: 检查并确保 role 字段在响应中**

`getCurrentUser()` 已经返回 `{id, username, displayName, role}`，确认 `/api/auth/me` 将其完整返回。如果有遗漏则补上。

**Step 2: Commit（如有改动）**

```bash
git add src/app/api/auth/me/route.ts
git commit -m "fix: ensure /api/auth/me returns user role field"
```

---

## Phase 3: 自动助手模式

### Task 8: 创建 auto-agent 路由逻辑

**Objective:** 新增自动助手，根据用户消息内容由 LLM 做意图分类，路由到 chat/research/code agent。

**Files:**

- Create: `src/mastra/agents/auto-agent.ts`
- Modify: `src/mastra/index.ts` — 注册新 agent

**Step 1: 创建 auto-agent**

auto-agent 的 system prompt 核心：

```
你是一个智能路由助手。根据用户的消息，你会自动选择最合适的模式来回答：
- 日常对话、问答、翻译等 → 聊天模式
- 深度分析、调研、报告撰写 → 研究模式
- 代码编写、调试、技术问题 → 代码模式

直接以对应模式回答用户，不要告知用户你选择了哪个模式。
```

实现方式：auto-agent 不是独立路由，而是融合三个 agent 的 system prompt，让 LLM 自行判断风格。这样避免了额外一次分类调用的延迟。

```typescript
// src/mastra/agents/auto-agent.ts
import { Agent } from "@mastra/core/agent"
import { datasourceQueryTool, datasourceListTool } from "../tools/datasource"

export const autoAgent = new Agent({
  id: "auto-agent",
  name: "自动",
  instructions: `你是 xinsight AI 助手，能够根据用户需求自动切换工作模式：

【聊天模式】用于日常对话、问答、翻译、创意写作等
- 友好、简洁、自然地回答

【研究模式】用于深度分析、调研、数据解读、报告撰写
- 结构化输出，引用数据源，提供多角度分析

【代码模式】用于代码编写、调试、代码审查、技术架构讨论
- 提供完整可运行的代码，包含注释和最佳实践

根据用户消息自动选择最合适的模式，直接回答，无需告知使用了哪个模式。
如果用户查询涉及已配置的数据源，主动使用数据源工具获取实时数据。`,
  tools: { datasourceQuery: datasourceQueryTool, datasourceList: datasourceListTool },
})
```

**Step 2: 注册到 Mastra**

```typescript
// src/mastra/index.ts
import { autoAgent } from "./agents/auto-agent"

export const mastra = new Mastra({
  agents: { autoAgent, chatAgent, researchAgent, codeAgent },
})
```

**Step 3: Commit**

```bash
git add src/mastra/agents/auto-agent.ts src/mastra/index.ts
git commit -m "feat: add auto-agent with intelligent mode routing

Auto-agent combines chat/research/code capabilities and automatically
selects the appropriate response style based on user input."
```

---

### Task 9: 前端 — 将助手选择器和模型名称移到输入框附近

**Objective:** 重构聊天页面 UI，将助手选择器和模型选择器从顶部移到输入框区域，"自动"设为默认。

**Files:**

- Modify: `src/app/page.tsx`
- 可能 Create: `src/components/chat-input-toolbar.tsx` — 输入框上方的工具栏组件

**Step 1: 创建输入框工具栏组件**

在输入框上方显示：

- 助手选择下拉：自动（默认）、聊天助手、研究助手、代码助手
- 模型选择下拉：从 `/api/models` 获取可用模型列表

```typescript
// src/components/chat-input-toolbar.tsx
// 紧凑的工具栏，包含两个小型下拉选择器
// 助手列表现在包含 autoAgent 且为默认
// 模型列表从 API 动态获取
```

**Step 2: 修改 page.tsx**

1. 移除顶部的 agent 选择器和 model 展示
2. 在 `<PromptInput>` 上方嵌入 `<ChatInputToolbar>`
3. agent 列表改为：`[{ key: 'autoAgent', name: '自动' }, { key: 'chatAgent', name: '聊天助手' }, ...]`
4. 默认 agent 改为 `'autoAgent'`

**Step 3: 验证**

Run: `cd ~/xinsight && bun run dev`
手动测试：打开聊天页面，确认工具栏在输入框附近，自动为默认选项。

**Step 4: Commit**

```bash
git add src/components/chat-input-toolbar.tsx src/app/page.tsx
git commit -m "feat: move agent/model selectors near chat input

Add ChatInputToolbar component above the prompt input area.
Auto agent is now the default selection. Model list fetched from API."
```

---

## Phase 4: 管理员模型选择界面

### Task 10: 重构设置页面 — 管理员可选模型，含配置提示

**Objective:** 设置页面中模型选择仅对管理员可见，显示环境变量配置提示。

**Files:**

- Modify: `src/app/settings/page.tsx`

**Step 1: 重构设置页面**

1. 用 `useUser()` 检查角色
2. 管理员：显示模型选择区（从 `/api/models` 获取），按提供商分组
3. 普通用户：隐藏模型选择区
4. 在模型选择区底部添加提示文字：

```
ℹ️ 模型提供商通过环境变量配置。如需添加或变更提供商，请修改部署配置中的以下环境变量：
• LLM_PROVIDERS — 启用的提供商列表
• [PROVIDER]_API_KEY — 提供商 API 密钥
• [PROVIDER]_MODELS — 可用模型列表
详见 .env.example 文件。
```

5. 如果只有一个模型，下拉框只显示一个选项（无需特殊处理，自然行为）

**Step 2: Commit**

```bash
git add src/app/settings/page.tsx
git commit -m "feat: admin-only model selection with env config hint

Model selection in settings is now visible only to admins.
Shows a hint about configuring providers via environment variables."
```

---

## Phase 5: 清理和收尾

### Task 11: 清理遗留代码

**Objective:** 移除不再需要的海外提供商硬编码引用。

**Files:**

- Check & clean: `src/lib/models.ts` 中海外提供商的 `defaultModels` 可以保留（作为注册表），因为通过 `LLM_PROVIDERS` 控制启用
- Remove: `.env.example` 中已注释的海外提供商 key 可保留作参考
- Remove: 任何直接 import `openai`/`anthropic` provider 的代码（如果有）

**Step 1: 搜索并清理**

```bash
# 搜索直接引用海外 provider 的代码
rg -l "openai|anthropic|google.*generative" src/ --glob '!*.d.ts'
```

移除不必要的依赖 import。

**Step 2: Commit**

```bash
git add -A
git commit -m "chore: clean up unused provider references"
```

---

### Task 12: 全量测试与验证

**Objective:** 验证所有功能正常工作。

**验证清单：**

1. **环境变量模型配置**
   - [ ] 只配 DEEPSEEK_API_KEY → 只有 DeepSeek 模型可用
   - [ ] 同时配 DASHSCOPE_API_KEY → DeepSeek + Qwen 模型都可用
   - [ ] `/api/models` 返回正确的提供商和模型列表

2. **权限控制**
   - [ ] admin 用户：能看到侧边栏"数据源管理"，能访问 `/admin/*`
   - [ ] 普通用户：侧边栏无管理入口，直接访问 `/admin` 被重定向
   - [ ] 普通用户调用管理 API（POST /api/datasources）返回 403

3. **自动助手**
   - [ ] 默认选中"自动"
   - [ ] 发送日常问题 → 得到聊天风格回复
   - [ ] 发送代码问题 → 得到代码风格回复
   - [ ] 可以手动切换到其他助手

4. **UI 布局**
   - [ ] 助手选择器在输入框附近
   - [ ] 模型显示在输入框附近

5. **模型切换**
   - [ ] 管理员能在设置中切换模型
   - [ ] 切换后对话使用新模型
   - [ ] 设置页显示环境变量配置提示

---

## 任务依赖图

```
Task 1 (models.ts 重写)
  ├── Task 2 (/api/models 端点)
  │     └── Task 9 (前端选择器 UI)
  │           └── Task 10 (设置页重构)
  └── Task 3 (chat API 动态模型)

Task 4 (requireAdmin)
  └── Task 5 (API 权限保护)

Task 6 (前端角色 context) ← 依赖 Task 7
Task 7 (/api/auth/me role)

Task 8 (auto-agent) → Task 9 (UI 中包含自动选项)

Task 11 (清理) ← 所有 feature task 完成后
Task 12 (验证) ← 所有 task 完成后
```

**可并行的 task 组：**

- Group A: Task 1 → 2 → 3（模型配置链路）
- Group B: Task 4 → 5（后端权限）
- Group C: Task 7 → 6（前端权限）
- Group D: Task 8（自动助手）
- 汇合: Task 9（UI 重构，依赖 A + C + D）→ Task 10 → Task 11 → Task 12
