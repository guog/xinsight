import { NextResponse } from "next/server"
import { getProviders, getModels, getDefaultModelId } from "@/lib/models"
import { getCurrentUser } from "@/lib/auth"

/** GET /api/models — 返回可用模型列表（需登录，已脱敏） */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 })
  }

  const providers = getProviders().map(({ apiKey, baseUrl, envKey, ...rest }) => ({
    ...rest,
    models: rest.models.map(({ id, name }) => ({ id, name })),
  }))

  const models = getModels().map(({ id, name, providerId }) => ({
    id,
    name,
    providerId,
  }))

  const defaultModelId = getDefaultModelId()

  return NextResponse.json({ providers, models, defaultModelId })
}
