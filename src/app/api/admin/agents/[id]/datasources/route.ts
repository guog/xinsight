import { NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/db"
import { agentDatasources } from "@/db/schema"
import { eq } from "drizzle-orm"
import { requireAdmin, handleAuthError } from "@/lib/auth"

type Params = { params: Promise<{ id: string }> }

const BindingsSchema = z.object({
  bindings: z.array(
    z.object({
      datasourceId: z.string().min(1),
      endpointIds: z.array(z.string()).nullable(),
    }),
  ),
})

export async function GET(_req: Request, { params }: Params) {
  try {
    await requireAdmin()
  } catch (e) {
    return handleAuthError(e)
  }

  const { id } = await params
  const rows = await db.select().from(agentDatasources).where(eq(agentDatasources.agentId, id))

  const bindings = rows.map((r) => {
    let endpointIds: string[] | null = null
    if (r.endpointIds) {
      try {
        endpointIds = JSON.parse(r.endpointIds)
      } catch {
        endpointIds = null
      }
    }
    return { datasourceId: r.datasourceId, endpointIds }
  })

  return NextResponse.json({ bindings })
}

export async function PUT(req: Request, { params }: Params) {
  try {
    await requireAdmin()
  } catch (e) {
    return handleAuthError(e)
  }

  const { id } = await params
  const body = await req.json()
  const parsed = BindingsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "输入校验失败", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  const { bindings } = parsed.data

  db.transaction((tx) => {
    tx.delete(agentDatasources).where(eq(agentDatasources.agentId, id)).run()
    for (const b of bindings) {
      tx.insert(agentDatasources)
        .values({
          agentId: id,
          datasourceId: b.datasourceId,
          endpointIds: b.endpointIds ? JSON.stringify(b.endpointIds) : null,
          createdAt: new Date(),
        })
        .run()
    }
  })

  return NextResponse.json({ success: true })
}
