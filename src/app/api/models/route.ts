import { NextResponse } from "next/server"
import { getProviders, getModels, getDefaultModelId } from "@/lib/models"

/** GET /api/models — 返回可用模型列表（已脱敏） */
export async function GET() {
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
