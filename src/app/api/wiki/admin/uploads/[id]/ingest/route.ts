import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/db"
import { wikiUploads } from "@/db/schema"
import { eq } from "drizzle-orm"
import { triggerIngest } from "@/lib/wiki/ingest-pipeline"
import { taskRunner } from "@/lib/wiki/task-runner"

// 触发单文件摄入
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "无权限" }, { status: 403 })
  }

  const { id } = await params
  const uploadId = Number(id)

  const [upload] = await db.select().from(wikiUploads).where(eq(wikiUploads.id, uploadId))
  if (!upload) {
    return NextResponse.json({ error: "上传记录不存在" }, { status: 404 })
  }

  const taskId = await triggerIngest(upload, taskRunner)

  return NextResponse.json({ taskId, message: "摄入任务已触发" })
}
