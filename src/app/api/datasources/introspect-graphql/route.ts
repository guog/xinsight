import { NextResponse } from "next/server"
import { introspectGraphql } from "@/lib/importers/graphql-introspector"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { endpoint, headers } = body as { endpoint?: string; headers?: Record<string, string> }

    if (!endpoint) {
      return NextResponse.json({ error: "需要提供 endpoint" }, { status: 400 })
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
