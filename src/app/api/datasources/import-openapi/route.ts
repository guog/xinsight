import { NextResponse } from "next/server"
import { parseOpenApiSpec } from "@/lib/importers/openapi-parser"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { url, content } = body as { url?: string; content?: string }

    if (!url && !content) {
      return NextResponse.json({ error: "需要提供 url 或 content" }, { status: 400 })
    }

    const input = url || content!
    const result = await parseOpenApiSpec(input)

    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "解析失败" },
      { status: 400 },
    )
  }
}
