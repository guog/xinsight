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
  return models.length > 0 ? models[0].id : (process.env.DEFAULT_MODEL_ID ?? "deepseek/deepseek-v4-flash")
}

export function getProviderForModel(modelId: string): ProviderInfo | undefined {
  const providerId = modelId.split("/")[0]
  return resolveProviders().find((p) => p.id === providerId)
}
