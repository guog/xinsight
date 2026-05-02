import { NextResponse } from "next/server"
import { getProviders } from "@/lib/models"
import { getCurrentUser } from "@/lib/auth"

/** GET /api/models — 返回可用模型列表（需登录，已脱敏） */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 })
  }

  const providers = getProviders()

  // 脱敏：移除 apiKey，保留 type 供前端展示
  const sanitized = providers.map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type,
    models: p.models,
  }))

  return NextResponse.json({ providers: sanitized })
}
