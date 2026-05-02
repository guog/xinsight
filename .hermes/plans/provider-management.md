# 模型提供商动态管理 实现计划

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 让管理员通过 Admin UI 动态管理 AI 模型提供商（云端+本地），支持模型自动发现与同步，消除环境变量硬编码依赖。

**Architecture:** DB 持久化提供商配置 → API CRUD → 模型同步服务（支持 OpenAI/Ollama 两种 API 格式）→ Admin UI 管理界面。env 作为首次启动种子和 fallback。

**Tech Stack:** Bun + TypeScript + Next.js 16 + Drizzle ORM (bun:sqlite) + @ai-sdk/openai-compatible + shadcn/ui

---

## Phase 1: 数据层

### Task 1: 新增 llmProviders 表 schema

**Objective:** 定义提供商持久化表结构

**Files:**

- Modify: `src/db/schema.ts`

**Step 1: 在 schema.ts 末尾添加 llmProviders 表**

```typescript
/** LLM 提供商配置 */
export const llmProviders = sqliteTable("llm_providers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull().default("cloud"), // "cloud" | "local"
  apiFormat: text("api_format").notNull().default("openai"), // "openai" | "ollama"
  baseUrl: text("base_url").notNull(),
  apiKey: text("api_key").notNull().default(""),
  apiKeyRequired: integer("api_key_required", { mode: "boolean" }).notNull().default(true),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  syncedAt: integer("synced_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
})
```

**Step 2: 验证**

Run: `cd ~/xinsight && bun run build 2>&1 | grep -i error | grep -v node_modules`
Expected: 无业务代码错误

---

### Task 2: 新增 llmModels 表 schema

**Objective:** 定义模型持久化表结构

**Files:**

- Modify: `src/db/schema.ts`

**Step 1: 在 llmProviders 后添加 llmModels 表**

```typescript
/** LLM 模型 */
export const llmModels = sqliteTable(
  "llm_models",
  {
    id: text("id").primaryKey(), // 格式: "providerId/modelSlug"
    providerId: text("provider_id")
      .notNull()
      .references(() => llmProviders.id, { onDelete: "cascade" }),
    modelSlug: text("model_slug").notNull(),
    name: text("name").notNull(), // 显示名称（可自定义）
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
    status: text("status").notNull().default("available"), // "available" | "deprecated" | "offline"
    capabilities: text("capabilities").notNull().default("{}"), // JSON: {chat,vision,tools}
    sortOrder: integer("sort_order").notNull().default(0),
    discoveredAt: integer("discovered_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [index("idx_llm_models_provider").on(table.providerId)],
)
```

**Step 2: 验证 build**

Run: `cd ~/xinsight && bun run build 2>&1 | grep -i error | grep -v node_modules`
Expected: 无业务代码错误

---

### Task 3: 创建提供商预设模板

**Objective:** 定义云端和本地提供商的预设配置，用于新建和 env seed

**Files:**

- Create: `src/lib/provider-presets.ts`

**Step 1: 创建预设文件**

```typescript
/**
 * 提供商预设模板 — 新建提供商和 env seed 时使用
 */
export interface ProviderPreset {
  id: string
  name: string
  type: "cloud" | "local"
  apiFormat: "openai" | "ollama"
  defaultBaseUrl: string
  apiKeyRequired: boolean
  envKey?: string // 对应的环境变量名（用于 seed）
  envBaseUrl?: string
  envModels?: string
  defaultModels: string[]
}

export const PROVIDER_PRESETS: Record<string, ProviderPreset> = {
  // 云端
  deepseek: {
    id: "deepseek",
    name: "DeepSeek",
    type: "cloud",
    apiFormat: "openai",
    defaultBaseUrl: "https://api.deepseek.com/v1",
    apiKeyRequired: true,
    envKey: "DEEPSEEK_API_KEY",
    envBaseUrl: "DEEPSEEK_BASE_URL",
    envModels: "DEEPSEEK_MODELS",
    defaultModels: ["deepseek-v4-flash", "deepseek-v4-pro"],
  },
  qwen: {
    id: "qwen",
    name: "阿里云百炼 (Qwen)",
    type: "cloud",
    apiFormat: "openai",
    defaultBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    apiKeyRequired: true,
    envKey: "DASHSCOPE_API_KEY",
    envBaseUrl: "QWEN_BASE_URL",
    envModels: "QWEN_MODELS",
    defaultModels: ["qwen-max", "qwen-plus", "qwen-turbo", "qwq-max"],
  },
  openai: {
    id: "openai",
    name: "OpenAI",
    type: "cloud",
    apiFormat: "openai",
    defaultBaseUrl: "https://api.openai.com/v1",
    apiKeyRequired: true,
    envKey: "OPENAI_API_KEY",
    envBaseUrl: "OPENAI_BASE_URL",
    envModels: "OPENAI_MODELS",
    defaultModels: ["gpt-4o", "gpt-4o-mini"],
  },
  anthropic: {
    id: "anthropic",
    name: "Anthropic",
    type: "cloud",
    apiFormat: "openai",
    defaultBaseUrl: "https://api.anthropic.com",
    apiKeyRequired: true,
    envKey: "ANTHROPIC_API_KEY",
    envBaseUrl: "ANTHROPIC_BASE_URL",
    envModels: "ANTHROPIC_MODELS",
    defaultModels: ["claude-sonnet-4-20250514"],
  },
  // 本地
  ollama: {
    id: "ollama",
    name: "Ollama",
    type: "local",
    apiFormat: "ollama",
    defaultBaseUrl: "http://localhost:11434",
    apiKeyRequired: false,
    defaultModels: [],
  },
  litellm: {
    id: "litellm",
    name: "LiteLLM",
    type: "local",
    apiFormat: "openai",
    defaultBaseUrl: "http://localhost:4000/v1",
    apiKeyRequired: false,
    defaultModels: [],
  },
  vllm: {
    id: "vllm",
    name: "vLLM",
    type: "local",
    apiFormat: "openai",
    defaultBaseUrl: "http://localhost:8000/v1",
    apiKeyRequired: false,
    defaultModels: [],
  },
  localai: {
    id: "localai",
    name: "LocalAI",
    type: "local",
    apiFormat: "openai",
    defaultBaseUrl: "http://localhost:8080/v1",
    apiKeyRequired: false,
    defaultModels: [],
  },
}

/** 获取所有预设列表 */
export function getPresets(): ProviderPreset[] {
  return Object.values(PROVIDER_PRESETS)
}

/** 获取按类型分组的预设 */
export function getPresetsByType() {
  const presets = getPresets()
  return {
    cloud: presets.filter((p) => p.type === "cloud"),
    local: presets.filter((p) => p.type === "local"),
  }
}
```

---

### Task 4: 创建 seed 服务（env → DB）

**Objective:** 首次启动时从环境变量种子数据到 DB

**Files:**

- Create: `src/lib/provider-seed.ts`

**Step 1: 创建 seed 逻辑**

```typescript
import { db } from "@/db"
import { llmProviders, llmModels } from "@/db/schema"
import { count } from "drizzle-orm"
import { PROVIDER_PRESETS } from "./provider-presets"

/**
 * 从环境变量种子提供商配置到 DB
 * 仅在 DB 中无任何 provider 时执行（首次启动）
 */
export async function seedProvidersFromEnv(): Promise<void> {
  // 已有记录则跳过
  const [{ total }] = await db.select({ total: count() }).from(llmProviders)
  if (total > 0) return

  const now = new Date()
  const enabledIds = (process.env.LLM_PROVIDERS || "deepseek,qwen")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)

  let sortOrder = 0
  for (const id of enabledIds) {
    const preset = PROVIDER_PRESETS[id]
    if (!preset) continue

    // 检查是否有 API Key（云端必须有，本地可选）
    const apiKey = preset.envKey ? process.env[preset.envKey] || "" : ""
    if (preset.apiKeyRequired && !apiKey) continue

    const baseUrl = (preset.envBaseUrl && process.env[preset.envBaseUrl]) || preset.defaultBaseUrl

    // 解析模型列表
    const modelSlugs =
      preset.envModels && process.env[preset.envModels]
        ? process.env[preset.envModels]!.split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : preset.defaultModels

    // 写入 provider
    await db.insert(llmProviders).values({
      id: preset.id,
      name: preset.name,
      type: preset.type,
      apiFormat: preset.apiFormat,
      baseUrl,
      apiKey,
      apiKeyRequired: preset.apiKeyRequired,
      enabled: true,
      sortOrder: sortOrder++,
      createdAt: now,
      updatedAt: now,
    })

    // 写入 models
    for (let i = 0; i < modelSlugs.length; i++) {
      const slug = modelSlugs[i]
      await db.insert(llmModels).values({
        id: `${preset.id}/${slug}`,
        providerId: preset.id,
        modelSlug: slug,
        name: slug,
        enabled: true, // seed 的模型默认启用
        status: "available",
        capabilities: JSON.stringify({ chat: true }),
        sortOrder: i,
        discoveredAt: now,
        updatedAt: now,
      })
    }
  }
}
```

---

### Task 5: 在 DB 初始化时调用 seed

**Objective:** 确保应用启动时自动 seed

**Files:**

- Modify: `src/db/index.ts`

**Step 1: 在 db 初始化后调用 seedProvidersFromEnv**

在 `src/db/index.ts` 文件中，在现有 seed 逻辑后添加:

```typescript
import { seedProvidersFromEnv } from "@/lib/provider-seed"

// 在 migrate 和现有 seed 之后
seedProvidersFromEnv().catch((e) => console.error("Provider seed failed:", e))
```

---

## Phase 2: models.ts 改造

### Task 6: 重写 models.ts 从 DB 读取

**Objective:** 将模型注册表从 env 驱动改为 DB 驱动

**Files:**

- Rewrite: `src/lib/models.ts`

**Step 1: 完整重写 models.ts**

```typescript
/**
 * 模型注册表 — DB 驱动，env 作为 fallback
 */
import { db } from "@/db"
import { llmProviders, llmModels } from "@/db/schema"
import { eq, and } from "drizzle-orm"

export interface ModelInfo {
  id: string
  name: string
  providerId: string
  modelSlug: string
  description?: string
}

export interface ProviderInfo {
  id: string
  name: string
  type: "cloud" | "local"
  apiFormat: "openai" | "ollama"
  baseUrl: string
  apiKey: string
  enabled: boolean
  models: ModelInfo[]
}

// === 缓存 ===
let _cache: ProviderInfo[] | null = null
let _cacheTime = 0
const CACHE_TTL = 30_000 // 30s

/** 清除缓存（admin 修改后调用） */
export function invalidateModelCache() {
  _cache = null
  _cacheTime = 0
}

/** 供测试用 */
export function _resetCache() {
  invalidateModelCache()
}

function buildProviders(): ProviderInfo[] {
  // 从 DB 同步读取（Bun SQLite 是同步的）
  const providers = db
    .select()
    .from(llmProviders)
    .where(eq(llmProviders.enabled, true))
    .orderBy(llmProviders.sortOrder)
    .all()

  return providers.map((p) => {
    const models = db
      .select()
      .from(llmModels)
      .where(and(eq(llmModels.providerId, p.id), eq(llmModels.enabled, true)))
      .orderBy(llmModels.sortOrder)
      .all()

    return {
      id: p.id,
      name: p.name,
      type: p.type as "cloud" | "local",
      apiFormat: p.apiFormat as "openai" | "ollama",
      baseUrl: p.baseUrl,
      apiKey: p.apiKey,
      enabled: true,
      models: models.map((m) => ({
        id: m.id,
        name: m.name,
        providerId: m.providerId,
        modelSlug: m.modelSlug,
      })),
    }
  })
}

function resolveProviders(): ProviderInfo[] {
  const now = Date.now()
  if (_cache && now - _cacheTime < CACHE_TTL) {
    return _cache
  }
  _cache = buildProviders()
  _cacheTime = now
  return _cache
}

// === 导出函数 ===

export function getProviders(): ProviderInfo[] {
  return resolveProviders()
}

export function getModels(): ModelInfo[] {
  return resolveProviders().flatMap((p) => p.models)
}

export function getModelById(id: string): ModelInfo | undefined {
  return getModels().find((m) => m.id === id)
}

export function getDefaultModelId(): string {
  const models = getModels()
  return models.length > 0 ? models[0].id : "deepseek/deepseek-v4-flash"
}

export function getProviderForModel(modelId: string): ProviderInfo | undefined {
  const providerId = modelId.split("/")[0]
  return resolveProviders().find((p) => p.id === providerId)
}
```

**Step 2: 确认 API route 无需修改**

`src/app/api/chat/route.ts` 已经通过 `getProviderForModel()` + `createOpenAICompatible()` 动态实例化，接口不变，零修改。

---

### Task 7: 更新 /api/models route

**Objective:** 让模型列表 API 返回 type 和状态信息

**Files:**

- Modify: `src/app/api/models/route.ts`

**Step 1: 更新返回结构，增加 provider type**

```typescript
import { NextResponse } from "next/server"
import { getProviders } from "@/lib/models"

export async function GET() {
  const providers = getProviders()

  // 脱敏：移除 apiKey，保留 type/apiFormat 供前端展示
  const sanitized = providers.map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type,
    models: p.models,
  }))

  return NextResponse.json({ providers: sanitized })
}
```

---

## Phase 3: 模型同步服务

### Task 8: 创建模型同步服务

**Objective:** 实现从提供商 API 自动发现模型列表

**Files:**

- Create: `src/lib/provider-sync.ts`

**Step 1: 创建同步服务**

```typescript
import { db } from "@/db"
import { llmProviders, llmModels } from "@/db/schema"
import { eq } from "drizzle-orm"
import { invalidateModelCache } from "./models"

interface SyncResult {
  success: boolean
  added: string[]
  updated: string[]
  offlined: string[]
  error?: string
}

/**
 * 从提供商 API 获取远端模型列表
 */
async function fetchRemoteModels(
  baseUrl: string,
  apiFormat: "openai" | "ollama",
  apiKey: string,
): Promise<string[]> {
  const timeout = 5000

  if (apiFormat === "ollama") {
    // Ollama: GET /api/tags
    const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(timeout) })
    if (!res.ok) throw new Error(`Ollama API error: ${res.status}`)
    const data = await res.json()
    return (data.models || []).map((m: { name: string }) => m.name)
  } else {
    // OpenAI compatible: GET /v1/models or /models
    const url = baseUrl.endsWith("/v1") ? `${baseUrl}/models` : `${baseUrl}/v1/models`
    const headers: Record<string, string> = {}
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(timeout) })
    if (!res.ok) throw new Error(`API error: ${res.status}`)
    const data = await res.json()
    return (data.data || []).map((m: { id: string }) => m.id)
  }
}

/**
 * 同步单个提供商的模型列表
 */
export async function syncProviderModels(providerId: string): Promise<SyncResult> {
  const [provider] = await db
    .select()
    .from(llmProviders)
    .where(eq(llmProviders.id, providerId))
    .limit(1)

  if (!provider)
    return { success: false, added: [], updated: [], offlined: [], error: "Provider not found" }

  try {
    const remoteSlugs = await fetchRemoteModels(
      provider.baseUrl,
      provider.apiFormat as "openai" | "ollama",
      provider.apiKey,
    )
    const existingModels = await db
      .select()
      .from(llmModels)
      .where(eq(llmModels.providerId, providerId))

    const existingSlugs = new Set(existingModels.map((m) => m.modelSlug))
    const remoteSlugsSet = new Set(remoteSlugs)
    const now = new Date()

    const added: string[] = []
    const updated: string[] = []
    const offlined: string[] = []

    // 远端有 + DB 无 → 新增
    for (const slug of remoteSlugs) {
      if (!existingSlugs.has(slug)) {
        await db.insert(llmModels).values({
          id: `${providerId}/${slug}`,
          providerId,
          modelSlug: slug,
          name: slug,
          enabled: false, // 新发现的模型默认不启用
          status: "available",
          capabilities: JSON.stringify({ chat: true }),
          sortOrder: 0,
          discoveredAt: now,
          updatedAt: now,
        })
        added.push(slug)
      }
    }

    // 远端有 + DB 有 → 更新 status
    for (const model of existingModels) {
      if (remoteSlugsSet.has(model.modelSlug) && model.status !== "available") {
        await db
          .update(llmModels)
          .set({ status: "available", updatedAt: now })
          .where(eq(llmModels.id, model.id))
        updated.push(model.modelSlug)
      }
    }

    // 远端无 + DB 有 → 标记 offline
    for (const model of existingModels) {
      if (!remoteSlugsSet.has(model.modelSlug) && model.status === "available") {
        await db
          .update(llmModels)
          .set({ status: "offline", updatedAt: now })
          .where(eq(llmModels.id, model.id))
        offlined.push(model.modelSlug)
      }
    }

    // 更新 syncedAt
    await db
      .update(llmProviders)
      .set({ syncedAt: now, updatedAt: now })
      .where(eq(llmProviders.id, providerId))

    invalidateModelCache()
    return { success: true, added, updated, offlined }
  } catch (e) {
    return { success: false, added: [], updated: [], offlined: [], error: (e as Error).message }
  }
}

/**
 * 测试提供商连通性
 */
export async function testProviderConnection(
  baseUrl: string,
  apiFormat: "openai" | "ollama",
  apiKey: string,
): Promise<{ success: boolean; error?: string; modelCount?: number }> {
  try {
    const models = await fetchRemoteModels(baseUrl, apiFormat, apiKey)
    return { success: true, modelCount: models.length }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
```

---

## Phase 4: Admin API Routes

### Task 9: 创建 providers CRUD API

**Objective:** 实现提供商的增删改查接口

**Files:**

- Create: `src/app/api/admin/providers/route.ts`

**Step 1: GET + POST**

```typescript
import { NextResponse } from "next/server"
import { db } from "@/db"
import { llmProviders, llmModels } from "@/db/schema"
import { eq } from "drizzle-orm"
import { requireAdmin, handleAuthError } from "@/lib/auth"
import { invalidateModelCache } from "@/lib/models"

// GET /api/admin/providers — 列出所有提供商
export async function GET() {
  try {
    await requireAdmin()
  } catch (e) {
    return handleAuthError(e)
  }

  const providers = db.select().from(llmProviders).orderBy(llmProviders.sortOrder).all()
  const models = db.select().from(llmModels).all()

  // 组装并脱敏 apiKey
  const result = providers.map((p) => ({
    ...p,
    apiKey: p.apiKey ? `${p.apiKey.slice(0, 3)}****${p.apiKey.slice(-4)}` : "",
    models: models.filter((m) => m.providerId === p.id),
  }))

  return NextResponse.json({ providers: result })
}

// POST /api/admin/providers — 新增提供商
export async function POST(req: Request) {
  try {
    await requireAdmin()
  } catch (e) {
    return handleAuthError(e)
  }

  const body = await req.json()
  const { id, name, type, apiFormat, baseUrl, apiKey, apiKeyRequired, models: modelSlugs } = body

  if (!id || !name || !baseUrl) {
    return NextResponse.json({ error: "缺少必填字段" }, { status: 400 })
  }

  const now = new Date()

  // 检查 ID 是否已存在
  const existing = db.select().from(llmProviders).where(eq(llmProviders.id, id)).get()
  if (existing) {
    return NextResponse.json({ error: "提供商 ID 已存在" }, { status: 409 })
  }

  await db.insert(llmProviders).values({
    id,
    name,
    type: type || "cloud",
    apiFormat: apiFormat || "openai",
    baseUrl,
    apiKey: apiKey || "",
    apiKeyRequired: apiKeyRequired ?? true,
    enabled: true,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
  })

  // 如果提供了初始模型列表
  if (Array.isArray(modelSlugs) && modelSlugs.length > 0) {
    for (let i = 0; i < modelSlugs.length; i++) {
      const slug = modelSlugs[i]
      await db.insert(llmModels).values({
        id: `${id}/${slug}`,
        providerId: id,
        modelSlug: slug,
        name: slug,
        enabled: true,
        status: "available",
        capabilities: JSON.stringify({ chat: true }),
        sortOrder: i,
        discoveredAt: now,
        updatedAt: now,
      })
    }
  }

  invalidateModelCache()
  return NextResponse.json({ success: true, id }, { status: 201 })
}
```

---

### Task 10: 创建 provider 单项操作 API

**Objective:** 实现单个提供商的更新和删除

**Files:**

- Create: `src/app/api/admin/providers/[id]/route.ts`

**Step 1: PUT + DELETE**

```typescript
import { NextResponse } from "next/server"
import { db } from "@/db"
import { llmProviders } from "@/db/schema"
import { eq } from "drizzle-orm"
import { requireAdmin, handleAuthError } from "@/lib/auth"
import { invalidateModelCache } from "@/lib/models"

// PUT /api/admin/providers/[id]
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
  } catch (e) {
    return handleAuthError(e)
  }

  const { id } = await params
  const body = await req.json()
  const { name, baseUrl, apiKey, enabled, sortOrder } = body

  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (name !== undefined) updates.name = name
  if (baseUrl !== undefined) updates.baseUrl = baseUrl
  if (apiKey !== undefined) updates.apiKey = apiKey
  if (enabled !== undefined) updates.enabled = enabled
  if (sortOrder !== undefined) updates.sortOrder = sortOrder

  await db.update(llmProviders).set(updates).where(eq(llmProviders.id, id))
  invalidateModelCache()

  return NextResponse.json({ success: true })
}

// DELETE /api/admin/providers/[id]
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
  } catch (e) {
    return handleAuthError(e)
  }

  const { id } = await params
  await db.delete(llmProviders).where(eq(llmProviders.id, id))
  invalidateModelCache()

  return NextResponse.json({ success: true })
}
```

---

### Task 11: 创建 test/sync API

**Objective:** 实现连通性测试和模型同步接口

**Files:**

- Create: `src/app/api/admin/providers/[id]/test/route.ts`
- Create: `src/app/api/admin/providers/[id]/sync/route.ts`

**Step 1: test route**

```typescript
import { NextResponse } from "next/server"
import { db } from "@/db"
import { llmProviders } from "@/db/schema"
import { eq } from "drizzle-orm"
import { requireAdmin, handleAuthError } from "@/lib/auth"
import { testProviderConnection } from "@/lib/provider-sync"

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
  } catch (e) {
    return handleAuthError(e)
  }

  const { id } = await params
  const [provider] = db.select().from(llmProviders).where(eq(llmProviders.id, id)).limit(1).all()
  if (!provider) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const result = await testProviderConnection(
    provider.baseUrl,
    provider.apiFormat as "openai" | "ollama",
    provider.apiKey,
  )

  return NextResponse.json(result)
}
```

**Step 2: sync route**

```typescript
import { NextResponse } from "next/server"
import { requireAdmin, handleAuthError } from "@/lib/auth"
import { syncProviderModels } from "@/lib/provider-sync"

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
  } catch (e) {
    return handleAuthError(e)
  }

  const { id } = await params
  const result = await syncProviderModels(id)
  return NextResponse.json(result)
}
```

---

### Task 12: 创建 models 管理 API

**Objective:** 管理提供商下模型的启用/禁用

**Files:**

- Create: `src/app/api/admin/providers/[id]/models/route.ts`

**Step 1: GET + PATCH**

```typescript
import { NextResponse } from "next/server"
import { db } from "@/db"
import { llmModels } from "@/db/schema"
import { eq } from "drizzle-orm"
import { requireAdmin, handleAuthError } from "@/lib/auth"
import { invalidateModelCache } from "@/lib/models"

// GET — 列出该 provider 下所有模型
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
  } catch (e) {
    return handleAuthError(e)
  }

  const { id } = await params
  const models = db
    .select()
    .from(llmModels)
    .where(eq(llmModels.providerId, id))
    .orderBy(llmModels.sortOrder)
    .all()
  return NextResponse.json({ models })
}

// PATCH — 批量更新模型启用状态
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
  } catch (e) {
    return handleAuthError(e)
  }

  const { id } = await params
  const { models }: { models: { slug: string; enabled: boolean; name?: string }[] } =
    await req.json()

  const now = new Date()
  for (const m of models) {
    const updates: Record<string, unknown> = { enabled: m.enabled, updatedAt: now }
    if (m.name) updates.name = m.name
    await db
      .update(llmModels)
      .set(updates)
      .where(eq(llmModels.id, `${id}/${m.slug}`))
  }

  invalidateModelCache()
  return NextResponse.json({ success: true })
}
```

---

## Phase 5: Admin UI

### Task 13: Admin 布局添加模型管理 tab

**Objective:** 在 admin 导航中添加"模型管理"入口

**Files:**

- Modify: `src/app/admin/layout.tsx`

**Step 1: 在 navItems 数组中添加**

```typescript
{ href: "/admin/providers", label: "模型管理", icon: Cpu },
```

（需要 import `Cpu` from lucide-react）

---

### Task 14: 创建模型管理主页面

**Objective:** 展示提供商列表卡片

**Files:**

- Create: `src/app/admin/providers/page.tsx`

**主要功能:**

- 获取 `/api/admin/providers` 列出所有提供商
- 每个提供商显示卡片：名称、类型标签(云端/本地)、Base URL、API Key(脱敏)、模型数量、状态
- 卡片操作按钮：测试连接、同步模型、编辑、禁用/启用、删除
- 顶部 [+ 添加提供商] 按钮

---

### Task 15: 创建添加/编辑提供商对话框

**Objective:** 提供商配置的表单 UI

**Files:**

- Create: `src/app/admin/providers/components/provider-dialog.tsx`

**主要功能:**

- 选择预设（显示云端和本地分组）或自定义
- 填写: 名称、ID、Base URL、API Key、API 格式
- 测试连接按钮（调 testProviderConnection 直接用输入的值）
- 保存时调 POST/PUT API

---

### Task 16: 创建模型管理面板

**Objective:** 管理单个提供商下的模型启用/禁用

**Files:**

- Create: `src/app/admin/providers/components/models-panel.tsx`

**主要功能:**

- 显示模型列表：名称、状态标签（在线/离线）、启用开关
- 刷新按钮（调 sync API）
- 新发现的模型高亮提示
- 已下线模型灰显

---

### Task 17: 创建 presets API (公开)

**Objective:** 让前端获取预设列表

**Files:**

- Create: `src/app/api/admin/providers/presets/route.ts`

```typescript
import { NextResponse } from "next/server"
import { requireAdmin, handleAuthError } from "@/lib/auth"
import { getPresetsByType } from "@/lib/provider-presets"

export async function GET() {
  try {
    await requireAdmin()
  } catch (e) {
    return handleAuthError(e)
  }
  return NextResponse.json(getPresetsByType())
}
```

---

## Phase 6: 集成与测试

### Task 18: 编写 provider CRUD 测试

**Objective:** 验证 API 端到端正确性

**Files:**

- Create: `src/__tests__/providers.test.ts`

**测试点:**

- seed 从 env 写入 DB
- GET /api/admin/providers 返回脱敏数据
- POST 创建新 provider + models
- PUT 更新 provider
- DELETE 删除 provider（级联删除 models）
- PATCH models 启用/禁用
- invalidateModelCache 生效
- getProviderForModel 从 DB 读取

---

### Task 19: 编写同步服务测试

**Objective:** 验证模型同步逻辑

**Files:**

- Create: `src/__tests__/provider-sync.test.ts`

**测试点:**

- OpenAI 格式同步（mock fetch）
- Ollama 格式同步（mock fetch）
- 新模型发现（enabled=false）
- 已有模型更新 status
- 下线模型标记 offline
- 连接超时处理
- testProviderConnection 成功/失败

---

### Task 20: 端到端验证

**Objective:** 确保整体链路 seed → DB → models.ts → chat route 正常

**Steps:**

1. 清空 DB，设置 env，启动应用
2. 验证 seed 自动执行
3. 通过 API 发起 chat，验证模型实例化正确
4. 通过 Admin API 添加新 provider
5. 验证新 provider 的模型可用于 chat
6. 同步模型，验证列表更新

---

## 任务依赖图

```
Phase 1 (数据层)
  Task 1-2 (schema) → Task 3 (presets) → Task 4-5 (seed)
                                              ↓
Phase 2 (models.ts)
  Task 6 (重写) → Task 7 (API route)
                        ↓
Phase 3 (同步)
  Task 8 (sync service)
          ↓
Phase 4 (Admin API)
  Task 9-12 (CRUD routes)
              ↓
Phase 5 (Admin UI)
  Task 13-17 (UI components)
                ↓
Phase 6 (测试)
  Task 18-20
```

## 注意事项

1. **Drizzle 迁移**: 新增表后需要 `bun run db:generate && bun run db:migrate`，或利用现有 auto-migrate
2. **Ollama chat 兼容**: Ollama 的 chat 端点是 `{baseUrl}/v1/chat/completions`，`createOpenAICompatible` 传 `baseURL: baseUrl + "/v1"` 即可
3. **API Key 安全**: 当前项目 datasources.auth 也是明文存储，本期与其保持一致（不加密），后续统一加密
4. **缓存失效**: 所有写操作后都必须调 `invalidateModelCache()`
5. **Next.js 16 route params**: params 是 Promise，需要 `await params`
