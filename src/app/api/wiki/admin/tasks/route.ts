import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { taskRunner } from "@/lib/wiki/task-runner"
import { lintWiki } from "@/lib/wiki/lint"
import { autoFixIssues } from "@/lib/wiki/auto-fix"

// 获取所有任务列表
export async function GET() {
  const session = await getSession()
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 })
  }

  const tasks = taskRunner.getAllTasks()
  return NextResponse.json(tasks)
}

// 创建新任务
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 })
  }

  try {
    const { type } = await req.json()

    if (type === "lint") {
      const task = taskRunner.createTask("lint", async (ctx) => {
        ctx.reportProgress({ stage: "正在检查", percent: 0 })
        const issues = await lintWiki()
        ctx.reportProgress({ stage: "检查完成", percent: 100, issues })
        return issues
      })
      return NextResponse.json(task)
    }

    if (type === "auto-fix") {
      const task = taskRunner.createTask("auto-fix", async (ctx) => {
        ctx.reportProgress({ stage: "正在检查", percent: 0 })
        const issues = await lintWiki()
        const fixable = issues.filter((i: { autoFixable: boolean }) => i.autoFixable)
        ctx.reportProgress({ stage: "正在修复", percent: 50, total: fixable.length })
        await ctx.waitIfPaused()
        const result = await autoFixIssues(fixable)
        ctx.reportProgress({ stage: "修复完成", percent: 100, result })
        return result
      })
      return NextResponse.json(task)
    }

    if (type === "ingest") {
      const task = taskRunner.createTask("ingest", async (ctx) => {
        ctx.reportProgress({ stage: "正在导入", percent: 0 })
        // ingest 逻辑由 task runner 外部处理
        ctx.reportProgress({ stage: "导入完成", percent: 100 })
      })
      return NextResponse.json(task)
    }

    return NextResponse.json({ error: "不支持的任务类型" }, { status: 400 })
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "未知错误" },
      { status: 500 },
    )
  }
}
