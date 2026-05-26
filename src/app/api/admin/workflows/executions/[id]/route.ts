import { NextResponse } from "next/server"
import { db } from "@/db"
import { workflowExecutions, workflows } from "@/db/schema"
import { eq } from "drizzle-orm"
import { requireAdmin, handleAuthError } from "@/lib/auth"

type Params = { params: Promise<{ id?: string }> }

/** GET /api/admin/workflows/executions/[id] — 获取指定运行实例的详细 Trace logs */
export async function GET(_req: Request, { params }: Params) {
  try {
    await requireAdmin()
  } catch (e) {
    return handleAuthError(e)
  }

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: "缺少必要参数 id" }, { status: 400 })
  }
  try {
    const execution = db
      .select({
        id: workflowExecutions.id,
        workflowId: workflowExecutions.workflowId,
        workflowName: workflows.name,
        status: workflowExecutions.status,
        input: workflowExecutions.input,
        output: workflowExecutions.output,
        logs: workflowExecutions.logs,
        startedAt: workflowExecutions.startedAt,
        completedAt: workflowExecutions.completedAt,
      })
      .from(workflowExecutions)
      .leftJoin(workflows, eq(workflowExecutions.workflowId, workflows.id))
      .where(eq(workflowExecutions.id, id))
      .get()

    if (!execution) {
      return NextResponse.json({ error: "运行实例不存在" }, { status: 404 })
    }

    return NextResponse.json({
      execution: {
        ...execution,
        input: execution.input ? JSON.parse(execution.input) : {},
        output: execution.output ? JSON.parse(execution.output) : null,
        logs: execution.logs ? JSON.parse(execution.logs) : [],
      },
    })
  } catch (error) {
    console.error("获取运行实例详情失败:", error)
    return NextResponse.json({ error: "获取运行实例详情失败" }, { status: 500 })
  }
}
