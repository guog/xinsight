import { NextResponse } from "next/server"
import { db } from "@/db"
import { agentDatasources } from "@/db/schema"
import { eq } from "drizzle-orm"
import { requireAdmin, handleAuthError } from "@/lib/auth"

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  try {
    await requireAdmin()
  } catch (e) {
    return handleAuthError(e)
  }

  const { id } = await params
  const rows = await db.select().from(agentDatasources).where(eq(agentDatasources.agentId, id))

  const bindings = rows.map((r) => ({
    datasourceId: r.datasourceId,
    endpointIds: r.endpointIds ? JSON.parse(r.endpointIds) : null,
  }))

  return NextResponse.json({ bindings })
}

export async function PUT(req: Request, { params }: Params) {
  try {
    await requireAdmin()
  } catch (e) {
    return handleAuthError(e)
  }

  const { id } = await params
  const { bindings } = (await req.json()) as {
    bindings: { datasourceId: string; endpointIds: string[] | null }[]
  }

  db.delete(agentDatasources).where(eq(agentDatasources.agentId, id)).run()

  for (const b of bindings) {
    await db.insert(agentDatasources).values({
      agentId: id,
      datasourceId: b.datasourceId,
      endpointIds: b.endpointIds ? JSON.stringify(b.endpointIds) : null,
      createdAt: new Date(),
    })
  }

  return NextResponse.json({ success: true })
}
