import { NextResponse } from "next/server"
import { db } from "@/db"
import { workflowExecutions, workflows } from "@/db/schema"
import { desc, eq } from "drizzle-orm"
import { requireAdmin, handleAuthError } from "@/lib/auth"

/** GET /api/admin/workflows/executions — 获取所有工作流运行历史实例列表 */
export async function GET() {
  try {
    await requireAdmin()
  } catch (e) {
    return handleAuthError(e)
  }

  try {
    const list = db
      .select({
        id: workflowExecutions.id,
        workflowId: workflowExecutions.workflowId,
        workflowName: workflows.name,
        status: workflowExecutions.status,
        startedAt: workflowExecutions.startedAt,
        completedAt: workflowExecutions.completedAt,
      })
      .from(workflowExecutions)
      .leftJoin(workflows, eq(workflowExecutions.workflowId, workflows.id))
      .orderBy(desc(workflowExecutions.startedAt))
      .all()

    return NextResponse.json({ executions: list })
  } catch (error) {
    console.error("获取工作流运行记录失败:", error)
    return NextResponse.json({ error: "获取工作流运行记录失败" }, { status: 500 })
  }
}
