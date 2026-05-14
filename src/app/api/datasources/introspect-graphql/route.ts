import { NextResponse } from "next/server"
import { introspectGraphql } from "@/lib/importers/graphql-introspector"
import { requireAdmin, handleAuthError } from "@/lib/auth"
import { validateExternalUrl } from "@/lib/url-validation"

export async function POST(request: Request) {
  try {
    try {
      await requireAdmin()
    } catch (error) {
      return handleAuthError(error) ?? NextResponse.json({ error: "未知错误" }, { status: 500 })
    }

    const body = await request.json()
    const { endpoint, headers } = body as { endpoint?: string; headers?: Record<string, string> }

    if (!endpoint) {
      return NextResponse.json({ error: "需要提供 endpoint" }, { status: 400 })
    }

    // SSRF 防护
    const urlError = validateExternalUrl(endpoint)
    if (urlError) {
      return NextResponse.json({ error: urlError }, { status: 400 })
    }

    const result = await introspectGraphql(endpoint, headers)

    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "自省失败" },
      { status: 400 },
    )
  }
}
