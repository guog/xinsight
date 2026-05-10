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
