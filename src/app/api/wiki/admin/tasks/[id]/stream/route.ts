import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { taskRunner } from "@/lib/wiki/task-runner"

// SSE 流式推送任务进度
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 })
  }

  const { id } = await params
  const task = taskRunner.getTask(id)
  if (!task) {
    return NextResponse.json({ error: "任务不存在" }, { status: 404 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      // 轮询任务进度，每 500ms 推送一次
      const interval = setInterval(() => {
        const current = taskRunner.getTask(id)
        if (!current) {
          send({ status: "not_found" })
          clearInterval(interval)
          controller.close()
          return
        }

        send({
          id: current.id,
          status: current.status,
          progress: current.progress,
        })

        // 任务结束时关闭流
        if (["completed", "failed", "cancelled"].includes(current.status)) {
          clearInterval(interval)
          controller.close()
        }
      }, 500)
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
