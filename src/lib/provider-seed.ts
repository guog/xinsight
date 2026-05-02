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
