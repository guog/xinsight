import { NextResponse } from "next/server"
import { parseOpenApiSpec } from "@/lib/importers/openapi-parser"
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
    const { url, content, readOnly } = body as {
      url?: string
      content?: string
      readOnly?: boolean
    }

    if (!url && !content) {
      return NextResponse.json({ error: "需要提供 url 或 content" }, { status: 400 })
    }

    // SSRF 防护：校验外部 URL
    if (url) {
      const urlError = validateExternalUrl(url)
      if (urlError) {
        return NextResponse.json({ error: urlError }, { status: 400 })
      }
    }

    const input = url || content!
    const result = await parseOpenApiSpec(input, { readOnly })

    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "解析失败" },
      { status: 400 },
    )
  }
}
