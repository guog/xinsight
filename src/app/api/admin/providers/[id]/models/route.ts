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
