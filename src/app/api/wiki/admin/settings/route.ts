import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/db"
import { wikiSettings } from "@/db/schema"

// 获取所有设置
export async function GET() {
  const user = await getCurrentUser()
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "无权限" }, { status: 403 })
  }

  const settings = await db.select().from(wikiSettings)
  const result: Record<string, string> = {}
  for (const s of settings) {
    result[s.key] = s.value
  }
  return NextResponse.json({ settings: result })
}

// 更新设置（key-value 对）
export async function PUT(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "无权限" }, { status: 403 })
  }

  const body = (await request.json()) as Record<string, string>

  for (const [key, value] of Object.entries(body)) {
    await db
      .insert(wikiSettings)
      .values({ key, value })
      .onConflictDoUpdate({ target: wikiSettings.key, set: { value } })
  }

  return NextResponse.json({ message: "设置已更新" })
}
