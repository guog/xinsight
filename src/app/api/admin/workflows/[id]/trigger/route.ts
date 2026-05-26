import { NextResponse } from "next/server"
import { WorkflowEngine } from "@/lib/workflow/workflow-engine"
import { requireAdmin, handleAuthError } from "@/lib/auth"

type Params = { params: Promise<{ id: string }> }

/** POST /api/admin/workflows/[id]/trigger — 手动触发指定工作流的异步或同步执行 */
export async function POST(req: Request, { params }: Params) {
  try {
    await requireAdmin()
  } catch (e) {
    return handleAuthError(e)
  }

  const { id } = await params
  try {
    const body = await req.json()
    const { input } = body as { input: Record<string, any> }

    const result = await WorkflowEngine.execute(id, input ?? {})
    return NextResponse.json({ success: true, result })
  } catch (error: any) {
    console.error("执行工作流失败:", error)
    return NextResponse.json({ error: error.message || "执行工作流失败" }, { status: 500 })
  }
}
