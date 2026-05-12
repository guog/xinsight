import { describe, test, expect, beforeEach, afterEach, afterAll, mock } from "bun:test"
import { db } from "@/db"
import { llmProviders, llmModels } from "@/db/schema"
import { eq } from "drizzle-orm"
import {
  getProviders,
  getModels,
  getModelById,
  getProviderForModel,
  invalidateModelCache,
  _resetCache,
} from "@/lib/models"
import { syncProviderModels } from "@/lib/provider/sync"

// === 工具函数 ===

function insertProvider(overrides: Partial<typeof llmProviders.$inferInsert> = {}) {
  const now = new Date()
  const defaults = {
    id: "test-provider",
    name: "Test Provider",
    type: "cloud",
    apiFormat: "openai",
    baseUrl: "https://api.test.com/v1",
    apiKey: "sk-test-key",
    apiKeyRequired: true,
    enabled: true,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
  }
  const values = { ...defaults, ...overrides }
  db.insert(llmProviders).values(values).run()
  insertedProviderIds.push(values.id)
  return values
}

function insertModel(overrides: Partial<typeof llmModels.$inferInsert> = {}) {
  const now = new Date()
  const defaults = {
    id: "test-provider/test-model",
    providerId: "test-provider",
    modelSlug: "test-model",
    name: "test-model",
    enabled: true,
    status: "available",
    capabilities: JSON.stringify({ chat: true }),
    sortOrder: 0,
    discoveredAt: now,
    updatedAt: now,
  }
  const values = { ...defaults, ...overrides }
  db.insert(llmModels).values(values).run()
  insertedModelIds.push(values.id)
  return values
}

// 追踪测试中插入的 ID，只清理自己的数据
const insertedProviderIds: string[] = []
const insertedModelIds: string[] = []

// 保存 seed 数据以便 afterEach 恢复
let savedProviders: Array<typeof llmProviders.$inferSelect> = []
let savedModels: Array<typeof llmModels.$inferSelect> = []

function cleanup() {
  // 保存现有 seed 数据（仅首次）
  if (savedProviders.length === 0 && savedModels.length === 0) {
    savedProviders = db.select().from(llmProviders).all()
    savedModels = db.select().from(llmModels).all()
  }
  // 清空整张表，确保测试隔离
  db.delete(llmModels).run()
  db.delete(llmProviders).run()
  insertedModelIds.length = 0
  insertedProviderIds.length = 0
  _resetCache()
}

function restoreSeedData() {
  // 清空并恢复 seed 数据
  db.delete(llmModels).run()
  db.delete(llmProviders).run()
  for (const p of savedProviders) {
    db.insert(llmProviders).values(p).onConflictDoNothing().run()
  }
  for (const m of savedModels) {
    db.insert(llmModels).values(m).onConflictDoNothing().run()
  }
  _resetCache()
}

// === 测试 ===

describe("provider-seed: seedProvidersFromEnv", () => {
  const origEnv = { ...process.env }

  beforeEach(() => {
    cleanup()
  })

  afterEach(() => {
    cleanup()
    // 恢复环境变量
    Object.keys(process.env).forEach((k) => {
      if (!(k in origEnv)) delete process.env[k]
      else process.env[k] = origEnv[k]
    })
  })

  test("从环境变量种子提供商和模型到 DB", async () => {
    process.env.LLM_PROVIDERS = "deepseek"
    process.env.DEEPSEEK_API_KEY = "sk-test-123"

    const { seedProvidersFromEnv } = await import("@/lib/provider/seed")
    await seedProvidersFromEnv()

    const providers = db.select().from(llmProviders).all()
    expect(providers.length).toBeGreaterThanOrEqual(1)

    const ds = providers.find((p) => p.id === "deepseek")
    expect(ds).toBeTruthy()
    expect(ds!.name).toBe("DeepSeek")
    expect(ds!.apiKey).toBe("sk-test-123")

    const models = db.select().from(llmModels).where(eq(llmModels.providerId, "deepseek")).all()
    expect(models.length).toBeGreaterThan(0)
    for (const m of models) {
      expect(m.id).toMatch(/^deepseek\//)
      expect(m.enabled).toBe(true)
      expect(m.status).toBe("available")
      insertedModelIds.push(m.id)
    }
    insertedProviderIds.push("deepseek")
  })

  test("幂等——DB 已有 provider 时跳过", async () => {
    insertProvider({ id: "existing", name: "Existing" })

    process.env.LLM_PROVIDERS = "deepseek"
    process.env.DEEPSEEK_API_KEY = "sk-test-123"

    const { seedProvidersFromEnv } = await import("@/lib/provider/seed")
    await seedProvidersFromEnv()

    const providers = db.select().from(llmProviders).all()
    // 应该仍只有 existing，不会新增 deepseek
    expect(providers).toHaveLength(1)
    expect(providers[0].id).toBe("existing")
  })

  test("缺少 API Key 时跳过需要 Key 的提供商", async () => {
    process.env.LLM_PROVIDERS = "deepseek"
    delete process.env.DEEPSEEK_API_KEY

    const { seedProvidersFromEnv } = await import("@/lib/provider/seed")
    await seedProvidersFromEnv()

    const providers = db.select().from(llmProviders).all()
    expect(providers).toHaveLength(0)
  })
})

describe("models.ts: 查询函数", () => {
  beforeEach(() => {
    cleanup()
  })

  afterEach(() => {
    cleanup()
  })

  test("getProviders 返回已启用的提供商及模型", () => {
    insertProvider({ id: "p1", name: "Provider 1", sortOrder: 0 })
    insertProvider({ id: "p2", name: "Provider 2", enabled: false, sortOrder: 1 })
    insertModel({ id: "p1/m1", providerId: "p1", modelSlug: "m1", name: "Model 1" })
    insertModel({ id: "p1/m2", providerId: "p1", modelSlug: "m2", name: "Model 2" })

    const providers = getProviders()
    expect(providers).toHaveLength(1)
    expect(providers[0].id).toBe("p1")
    expect(providers[0].models).toHaveLength(2)
  })

  test("getModels 返回所有已启用提供商的已启用模型", () => {
    insertProvider({ id: "p1", name: "P1" })
    insertModel({ id: "p1/m1", providerId: "p1", modelSlug: "m1" })
    insertModel({ id: "p1/m2", providerId: "p1", modelSlug: "m2", enabled: false })

    const models = getModels()
    expect(models).toHaveLength(1)
    expect(models[0].id).toBe("p1/m1")
  })

  test("getModelById 找到模型", () => {
    insertProvider({ id: "p1", name: "P1" })
    insertModel({ id: "p1/chat", providerId: "p1", modelSlug: "chat", name: "Chat Model" })

    const model = getModelById("p1/chat")
    expect(model).toBeTruthy()
    expect(model!.name).toBe("Chat Model")
    expect(model!.providerId).toBe("p1")
  })

  test("getModelById 找不到时返回 undefined", () => {
    expect(getModelById("nonexistent/model")).toBeUndefined()
  })

  test("getProviderForModel 根据 modelId 找到提供商", () => {
    insertProvider({ id: "deepseek", name: "DeepSeek" })
    insertModel({ id: "deepseek/chat", providerId: "deepseek", modelSlug: "chat" })

    const provider = getProviderForModel("deepseek/chat")
    expect(provider).toBeTruthy()
    expect(provider!.id).toBe("deepseek")
    expect(provider!.name).toBe("DeepSeek")
  })

  test("getProviderForModel 找不到时返回 undefined", () => {
    expect(getProviderForModel("nonexistent/model")).toBeUndefined()
  })
})

describe("invalidateModelCache", () => {
  beforeEach(() => {
    cleanup()
  })

  afterEach(() => {
    cleanup()
  })

  test("清除缓存后重新读取 DB 数据", () => {
    insertProvider({ id: "p1", name: "P1" })
    insertModel({ id: "p1/m1", providerId: "p1", modelSlug: "m1" })

    // 第一次读取，缓存
    const models1 = getModels()
    expect(models1).toHaveLength(1)

    // 直接往 DB 加模型，不 invalidate
    insertModel({ id: "p1/m2", providerId: "p1", modelSlug: "m2" })
    const models2 = getModels()
    // 仍从缓存返回
    expect(models2).toHaveLength(1)

    // invalidate 后重新读取
    invalidateModelCache()
    const models3 = getModels()
    expect(models3).toHaveLength(2)
  })
})

describe("provider-sync: syncProviderModels", () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    cleanup()
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    cleanup()
  })

  test("provider 不存在时返回错误", async () => {
    const result = await syncProviderModels("nonexistent")
    expect(result.success).toBe(false)
    expect(result.error).toContain("not found")
  })

  test("新增远端模型（openai 格式）", async () => {
    insertProvider({
      id: "p1",
      name: "P1",
      baseUrl: "https://api.test.com/v1",
      apiFormat: "openai",
    })

    // Mock fetch 返回模型列表
    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => ({
        data: [{ id: "model-a" }, { id: "model-b" }],
      }),
    })) as unknown as typeof fetch

    const result = await syncProviderModels("p1")
    expect(result.success).toBe(true)
    expect(result.added).toEqual(["model-a", "model-b"])
    expect(result.offlined).toEqual([])

    const models = db.select().from(llmModels).where(eq(llmModels.providerId, "p1")).all()
    expect(models).toHaveLength(2)
    expect(models[0].enabled).toBe(false)
    expect(models[0].status).toBe("available")
    models.forEach((m) => insertedModelIds.push(m.id))
  })

  test("已存在的模型不重复新增", async () => {
    insertProvider({
      id: "p1",
      name: "P1",
      baseUrl: "https://api.test.com/v1",
      apiFormat: "openai",
    })
    insertModel({ id: "p1/existing", providerId: "p1", modelSlug: "existing", status: "available" })

    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => ({
        data: [{ id: "existing" }, { id: "new-model" }],
      }),
    })) as unknown as typeof fetch

    const result = await syncProviderModels("p1")
    expect(result.success).toBe(true)
    expect(result.added).toEqual(["new-model"])
    expect(result.updated).toEqual([])
    expect(result.offlined).toEqual([])
  })

  test("远端无、DB 有 → 标记 offline", async () => {
    insertProvider({
      id: "p1",
      name: "P1",
      baseUrl: "https://api.test.com/v1",
      apiFormat: "openai",
    })
    insertModel({
      id: "p1/old-model",
      providerId: "p1",
      modelSlug: "old-model",
      status: "available",
    })

    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => ({ data: [] }),
    })) as unknown as typeof fetch

    const result = await syncProviderModels("p1")
    expect(result.success).toBe(true)
    expect(result.offlined).toEqual(["old-model"])

    const model = db.select().from(llmModels).where(eq(llmModels.id, "p1/old-model")).get()
    expect(model!.status).toBe("offline")
  })

  test("远端有 + DB 有 offline 状态 → 更新为 available", async () => {
    insertProvider({
      id: "p1",
      name: "P1",
      baseUrl: "https://api.test.com/v1",
      apiFormat: "openai",
    })
    insertModel({ id: "p1/comeback", providerId: "p1", modelSlug: "comeback", status: "offline" })

    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => ({ data: [{ id: "comeback" }] }),
    })) as unknown as typeof fetch

    const result = await syncProviderModels("p1")
    expect(result.success).toBe(true)
    expect(result.updated).toEqual(["comeback"])

    const model = db.select().from(llmModels).where(eq(llmModels.id, "p1/comeback")).get()
    expect(model!.status).toBe("available")
  })

  test("ollama 格式同步", async () => {
    insertProvider({
      id: "ollama",
      name: "Ollama",
      baseUrl: "http://localhost:11434",
      apiFormat: "ollama",
      apiKeyRequired: false,
      apiKey: "",
    })

    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => ({
        models: [{ name: "llama3" }, { name: "codellama" }],
      }),
    })) as unknown as typeof fetch

    const result = await syncProviderModels("ollama")
    expect(result.success).toBe(true)
    expect(result.added).toEqual(["llama3", "codellama"])
  })

  test("fetch 失败时返回错误", async () => {
    insertProvider({
      id: "p1",
      name: "P1",
      baseUrl: "https://api.test.com/v1",
      apiFormat: "openai",
    })

    globalThis.fetch = (async () => ({
      ok: false,
      status: 401,
    })) as unknown as typeof fetch

    const result = await syncProviderModels("p1")
    expect(result.success).toBe(false)
    expect(result.error).toBeTruthy()
  })

  test("同步后更新 provider 的 syncedAt", async () => {
    insertProvider({
      id: "p1",
      name: "P1",
      baseUrl: "https://api.test.com/v1",
      apiFormat: "openai",
    })

    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => ({ data: [] }),
    })) as unknown as typeof fetch

    await syncProviderModels("p1")

    const provider = db.select().from(llmProviders).where(eq(llmProviders.id, "p1")).get()
    expect(provider!.syncedAt).toBeTruthy()
  })
})

// 全部测试结束后恢复 seed 数据，防止影响其他测试文件
afterAll(() => {
  restoreSeedData()
})
