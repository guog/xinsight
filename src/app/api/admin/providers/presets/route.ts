import { NextResponse } from "next/server"
import { requireAdmin, handleAuthError } from "@/lib/auth"
import { getPresetsByType } from "@/lib/provider-presets"

export async function GET() {
  try {
    await requireAdmin()
  } catch (e) {
    return handleAuthError(e)
  }
  return NextResponse.json(getPresetsByType())
}
