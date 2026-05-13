import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { taskRunner } from "@/lib/wiki/task-runner"
import { lintWiki } from "@/lib/wiki/lint"
import { autoFixIssues } from "@/lib/wiki/auto-fix"
import { join } from "path"

const getWikiPath = () => process.env.WIKI_PATH || join(process.cwd(), "wiki")

// 获取所有任务列表
export async function GET() {
  const session = await getCurrentUser()
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 })
  }

  const tasks = taskRunner.getAllTasks()
  return NextResponse.json(tasks)
}

// 创建新任务
export async function POST(req: NextRequest) {
  const session = await getCurrentUser()
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 })
  }

  try {
    const { type } = await req.json()
    const wikiPath = getWikiPath()

    if (type === "lint") {
      const task = taskRunner.createTask("lint", async (ctx) => {
        ctx.reportProgress(0, 0, "正在检查")
        const report = await lintWiki(wikiPath, { signal: ctx.signal })
        ctx.reportProgress(report.scannedFiles, report.scannedFiles, "检查完成")
        return report
      })
      return NextResponse.json(task)
    }

    if (type === "auto-fix") {
      const task = taskRunner.createTask("auto-fix", async (ctx) => {
        ctx.reportProgress(0, 0, "正在检查")
        const report = await lintWiki(wikiPath, { signal: ctx.signal })
        const fixable = report.issues.filter((i) => i.autoFixable)
        ctx.reportProgress(0, fixable.length, "正在修复")
        await ctx.waitIfPaused()
        const result = await autoFixIssues(fixable, wikiPath, { signal: ctx.signal })
        ctx.reportProgress(fixable.length, fixable.length, "修复完成")
        return result
      })
      return NextResponse.json(task)
    }

    if (type === "ingest") {
      const task = taskRunner.createTask("ingest", async (ctx) => {
        ctx.reportProgress(0, 0, "正在导入")
        // ingest 逻辑由 task runner 外部处理
        ctx.reportProgress(1, 1, "导入完成")
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
