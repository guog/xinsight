import { NextResponse } from "next/server"
import { WorkflowEngine } from "@/lib/workflow/workflow-engine"
import { requireAdmin, handleAuthError } from "@/lib/auth"
import { z } from "zod"

type Params = { params: Promise<{ id?: string }> }

const TriggerBodySchema = z.object({
  input: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null(), z.undefined()]))
    .optional()
    .default({}),
})

/** POST /api/admin/workflows/[id]/trigger — 手动触发指定工作流的异步或同步执行 */
export async function POST(req: Request, { params }: Params) {
  let user
  try {
    user = await requireAdmin()
  } catch (e) {
    return handleAuthError(e)
  }

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: "缺少必要参数 id" }, { status: 400 })
  }

  try {
    const rawBody = await req.json()
    const parsed = TriggerBodySchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "输入数据格式不合法，仅支持扁平基本类型的 JSON 参数映射" },
        { status: 400 },
      )
    }

    const { input } = parsed.data
    // 设计决策说明: 目前此 trigger 接口由 requireAdmin 守卫拦截，仅向管理员开放。
    // 工作流引擎执行器 (WorkflowEngine.execute) 内部会对每个 Node 节点的权限进行 RBAC 鉴权校验。
    // 在这里，我们将当前操作人 (userId: user.id, role: user.role) 作为上下文传递给引擎，
    // 确保了后续若开放给普通用户时，也能通过传入非 admin 的 userId 达到权限安全隔离的目的。
    const result = await WorkflowEngine.execute(id, input, {
      userId: user.id,
      role: user.role,
    })
    return NextResponse.json({ success: true, result })
  } catch (error: any) {
    console.error("执行工作流失败:", error)
    return NextResponse.json({ error: error.message || "执行工作流失败" }, { status: 500 })
  }
}
