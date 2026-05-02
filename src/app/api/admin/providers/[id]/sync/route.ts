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
