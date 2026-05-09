import { NextResponse } from "next/server"
import { db } from "@/db"
import { agentDatasources } from "@/db/schema"
import { eq } from "drizzle-orm"

/** GET /api/agents/[id]/datasources — 获取某 Agent 绑定的数据源 ID 列表 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const bindings = db
    .select({
      datasourceId: agentDatasources.datasourceId,
      endpointIds: agentDatasources.endpointIds,
    })
    .from(agentDatasources)
    .where(eq(agentDatasources.agentId, id))
    .all()

  return NextResponse.json(
    bindings.map((b) => ({
      datasourceId: b.datasourceId,
      endpointIds: b.endpointIds ? JSON.parse(b.endpointIds) : null,
    })),
  )
}
