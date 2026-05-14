import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/db"
import { wikiFeedbacks } from "@/db/schema"
import { eq, desc } from "drizzle-orm"
import { resolve, join } from "path"

const WIKI_PATH = process.env.WIKI_PATH || join(process.cwd(), "wiki")

export async function GET() {
  const session = await getCurrentUser()
  if (!session) {
    return NextResponse.json({ error: "未登录" }, { status: 401 })
  }
  const feedbacks = db
    .select()
    .from(wikiFeedbacks)
    .where(eq(wikiFeedbacks.userId, session.id))
    .orderBy(desc(wikiFeedbacks.createdAt))
    .all()
  return NextResponse.json(feedbacks)
}

export async function POST(req: NextRequest) {
  const session = await getCurrentUser()
  if (!session) {
    return NextResponse.json({ error: "未登录" }, { status: 401 })
  }
  const { pageId, type, content } = await req.json()
  if (!pageId || !type || !content) {
    return NextResponse.json({ error: "缺少必填字段" }, { status: 400 })
  }
  // 路径遍历防护
  const fullPath = resolve(WIKI_PATH, pageId)
  const base = resolve(WIKI_PATH) + "/"
  if (!fullPath.startsWith(base) && fullPath !== resolve(WIKI_PATH)) {
    return NextResponse.json({ error: "pageId 路径非法" }, { status: 400 })
  }
  if (!["correction", "addition", "suggestion"].includes(type)) {
    return NextResponse.json({ error: "无效的反馈类型" }, { status: 400 })
  }
  const id = crypto.randomUUID()
  db.insert(wikiFeedbacks)
    .values({
      id,
      pageId,
      userId: session.id,
      type,
      content,
      status: "pending",
      createdAt: new Date(),
    })
    .run()
  return NextResponse.json({ id, status: "pending" }, { status: 201 })
}
