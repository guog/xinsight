import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { taskRunner } from "@/lib/wiki/task-runner"

// SSE 流式推送任务进度
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

  const encoder = new TextEncoder()
  let intervalId: ReturnType<typeof setInterval> | null = null

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {
          // 客户端已断开
          if (intervalId) {
            clearInterval(intervalId)
            intervalId = null
          }
        }
      }

      // 轮询任务进度，每 500ms 推送一次
      intervalId = setInterval(() => {
        const current = taskRunner.getTask(id)
        if (!current) {
          send({ status: "not_found" })
          if (intervalId) {
            clearInterval(intervalId)
            intervalId = null
          }
          try {
            controller.close()
          } catch {
            /* 已关闭 */
          }
          return
        }

        send({
          id: current.id,
          status: current.status,
          progress: current.progress,
        })

        // 任务结束时关闭流
        if (["completed", "failed", "cancelled"].includes(current.status)) {
          if (intervalId) {
            clearInterval(intervalId)
            intervalId = null
          }
          try {
            controller.close()
          } catch {
            /* 已关闭 */
          }
        }
      }, 500)
    },
    cancel() {
      // 客户端断开连接时自动调用
      if (intervalId) {
        clearInterval(intervalId)
        intervalId = null
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
