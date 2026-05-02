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
