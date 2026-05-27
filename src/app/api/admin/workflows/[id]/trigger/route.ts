import { NextResponse } from "next/server"
import { WorkflowEngine } from "@/lib/workflow/workflow-engine"
import { requireAdmin, handleAuthError } from "@/lib/auth"
import { z as zodStatic } from "zod"

// eslint-disable-next-line @typescript-eslint/no-require-imports
const z = zodStatic || require("zod").z

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
