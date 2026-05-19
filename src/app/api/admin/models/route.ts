import { NextResponse } from "next/server"
import { eq, asc } from "drizzle-orm"
import { db } from "@/db"
import { llmModels } from "@/db/schema"
import { requireAdmin, handleAuthError } from "@/lib/auth"

export async function GET() {
  try {
    await requireAdmin()
  } catch (e) {
    return handleAuthError(e)
  }

  const models = await db
    .select({
      id: llmModels.id,
      name: llmModels.name,
      providerId: llmModels.providerId,
    })
    .from(llmModels)
    .where(eq(llmModels.enabled, true))
    .orderBy(asc(llmModels.providerId), asc(llmModels.sortOrder))

  return NextResponse.json({ models })
}
