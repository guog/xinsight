import { NextResponse } from "next/server"
import { db } from "@/db"
import { requireAdmin, handleAuthError } from "@/lib/auth"
import { SqliteAgentRepository } from "@/db/repositories/agent-repository"
import { UpdateAgentSchema } from "@/lib/api-schemas"

const repo = new SqliteAgentRepository(db)

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  try {
    await requireAdmin()
  } catch (e) {
    return handleAuthError(e)
  }

  const { id } = await params
  const agent = await repo.findById(id)
  if (!agent) {
    return NextResponse.json({ error: "Agent 不存在" }, { status: 404 })
  }
  return NextResponse.json({ agent })
}

export async function PUT(req: Request, { params }: Params) {
  try {
    await requireAdmin()
  } catch (e) {
    return handleAuthError(e)
  }

  const { id } = await params
  const body = await req.json()
  const parsed = UpdateAgentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "输入校验失败", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  try {
    const agent = await repo.update(id, parsed.data)
    if (!agent) {
      return NextResponse.json({ error: "Agent 不存在" }, { status: 404 })
    }
    return NextResponse.json({ agent })
  } catch (e) {
    if (e instanceof Error && e.message.includes("不可修改")) {
      return NextResponse.json({ error: e.message }, { status: 403 })
    }
    throw e
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    await requireAdmin()
  } catch (e) {
    return handleAuthError(e)
  }

  const { id } = await params
  try {
    const deleted = await repo.delete(id)
    if (!deleted) {
      return NextResponse.json({ error: "Agent 不存在" }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (e) {
    if (e instanceof Error && e.message.includes("不可删除")) {
      return NextResponse.json({ error: e.message }, { status: 403 })
    }
    throw e
  }
}
