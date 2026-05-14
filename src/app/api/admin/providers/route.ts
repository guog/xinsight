import { NextResponse } from "next/server"
import { db } from "@/db"
import { llmProviders, llmModels } from "@/db/schema"
import { eq } from "drizzle-orm"
import { requireAdmin, handleAuthError } from "@/lib/auth"
import { invalidateModelCache } from "@/lib/models"
import { encrypt, decrypt } from "@/lib/crypto"
import { CreateProviderSchema } from "@/lib/api-schemas"
import { encrypt, decrypt } from "@/lib/crypto"

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
  const result = providers.map((p) => {
    let maskedKey = ""
    if (p.apiKey) {
      try {
        const plain = decrypt(p.apiKey)
        maskedKey = plain ? `${plain.slice(0, 3)}****${plain.slice(-4)}` : ""
      } catch {
        // 未迁移的明文 key
        maskedKey = `${p.apiKey.slice(0, 3)}****${p.apiKey.slice(-4)}`
      }
    }
    return {
      ...p,
      apiKey: maskedKey,
      models: models.filter((m) => m.providerId === p.id),
    }
  })

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

  // Zod 校验
  const parsed = CreateProviderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "输入校验失败", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  const { id, name, type, apiFormat, baseUrl, apiKey, apiKeyRequired, models: modelSlugs } = parsed.data

  const now = new Date()

  // 检查 ID 是否已存在
  const existing = db.select().from(llmProviders).where(eq(llmProviders.id, id)).get()
  if (existing) {
    return NextResponse.json({ error: "提供商 ID 已存在" }, { status: 409 })
  }

  await db.insert(llmProviders).values({
    id,
    name,
    type,
    apiFormat,
    baseUrl,
    apiKey: apiKey ? encrypt(apiKey) : "",
    apiKeyRequired,
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
