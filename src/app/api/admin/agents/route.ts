import { NextResponse } from "next/server"
import { db } from "@/db"
import { requireAdmin, handleAuthError } from "@/lib/auth"
import { SqliteAgentRepository } from "@/db/repositories/agent-repository"
import { CreateAgentSchema } from "@/lib/api-schemas"

const repo = new SqliteAgentRepository(db)

export async function GET() {
  try {
    await requireAdmin()
  } catch (e) {
    return handleAuthError(e)
  }

  const agents = await repo.findAll()
  return NextResponse.json({ agents })
}

export async function POST(req: Request) {
  try {
    await requireAdmin()
  } catch (e) {
    return handleAuthError(e)
  }

  const body = await req.json()
  const parsed = CreateAgentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "输入校验失败", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  try {
    const { modelId, ...rest } = parsed.data
    const agent = await repo.create({ ...rest, modelId: modelId ?? undefined })
    return NextResponse.json({ id: agent.id, agent }, { status: 201 })
  } catch (e) {
    if (e instanceof Error && e.message.includes("UNIQUE")) {
      return NextResponse.json({ error: "Agent ID 已存在" }, { status: 409 })
    }
    throw e
  }
}
