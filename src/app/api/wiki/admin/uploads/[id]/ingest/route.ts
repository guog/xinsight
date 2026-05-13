import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/db"
import { wikiUploads } from "@/db/schema"
import { eq } from "drizzle-orm"
import { triggerIngest } from "@/lib/wiki/ingest-pipeline"
import { taskRunner } from "@/lib/wiki/task-runner"
import { join } from "path"

const WIKI_PATH = process.env.WIKI_PATH || join(process.cwd(), "wiki")

// 触发单文件摄入
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "无权限" }, { status: 403 })
  }

  const { id } = await params

  const [upload] = await db.select().from(wikiUploads).where(eq(wikiUploads.id, id))
  if (!upload) {
    return NextResponse.json({ error: "上传记录不存在" }, { status: 404 })
  }

  const result = triggerIngest(id, db, wikiUploads, WIKI_PATH, taskRunner)

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ taskId: result.taskId, message: "摄入任务已触发" })
}
