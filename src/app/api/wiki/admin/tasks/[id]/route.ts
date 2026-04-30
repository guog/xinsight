import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { taskRunner } from "@/lib/wiki/task-runner"

// 获取单个任务详情
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentUser()
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 })
  }

  const { id } = await params
  const task = taskRunner.getTask(id)
  if (!task) {
    return NextResponse.json({ error: "任务不存在" }, { status: 404 })
  }
  return NextResponse.json(task)
}

// 控制任务：暂停、恢复、取消
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentUser()
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 })
  }

  try {
    const { id } = await params
    const { action } = await req.json()

    if (action === "pause") {
      taskRunner.pauseTask(id)
    } else if (action === "resume") {
      taskRunner.resumeTask(id)
    } else if (action === "cancel") {
      taskRunner.cancelTask(id)
    } else {
      return NextResponse.json({ error: "不支持的操作" }, { status: 400 })
    }

    const task = taskRunner.getTask(id)
    return NextResponse.json(task)
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "未知错误" },
      { status: 500 },
    )
  }
}
