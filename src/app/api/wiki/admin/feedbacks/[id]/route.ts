import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { db } from "@/db"
import { wikiFeedbacks } from "@/db/schema"
import { eq } from "drizzle-orm"
import { join } from "path"
import { readFile, writeFile } from "fs/promises"

const WIKI_PATH = process.env.WIKI_PATH || join(process.cwd(), "wiki")

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 })
  }
  const { id } = await params
  const { status, reviewNote } = await req.json()
  if (!["approved", "rejected"].includes(status)) {
    return NextResponse.json({ error: "无效状态" }, { status: 400 })
  }

  const feedback = db.select().from(wikiFeedbacks).where(eq(wikiFeedbacks.id, id)).get()
  if (!feedback) {
    return NextResponse.json({ error: "反馈不存在" }, { status: 404 })
  }

  // 如果通过且类型为 addition，追加内容到页面
  if (status === "approved" && feedback.type === "addition") {
    try {
      const fullPath = join(WIKI_PATH, feedback.pageId)
      const existing = await readFile(fullPath, "utf-8")
      const appended = existing + "\n\n" + feedback.content
      await writeFile(fullPath, appended, "utf-8")
    } catch {
      // 页面可能不存在，忽略自动追加
    }
  }

  db.update(wikiFeedbacks)
    .set({
      status,
      reviewNote: reviewNote || null,
      reviewedBy: session.userId,
      reviewedAt: new Date(),
    })
    .where(eq(wikiFeedbacks.id, id))
    .run()

  return NextResponse.json({ ok: true })
}
