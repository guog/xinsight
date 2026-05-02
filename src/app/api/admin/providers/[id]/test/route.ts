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
