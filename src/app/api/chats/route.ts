import { NextResponse } from "next/server"
import { db } from "@/db"
import { chats } from "@/db/schema"
import { desc, eq } from "drizzle-orm"
import { getCurrentUser } from "@/lib/auth"
import { CreateChatSchema } from "@/lib/api-schemas"

/** GET /api/chats — 获取当前用户的对话列表 */
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 })
    }
    const list = await db
      .select()
      .from(chats)
      .where(eq(chats.userId, user.id))
      .orderBy(desc(chats.updatedAt))
    return NextResponse.json(list)
  } catch (error) {
    console.error("获取对话列表失败:", error)
    return NextResponse.json({ error: "获取对话列表失败" }, { status: 500 })
  }
}

/** POST /api/chats — 创建新对话 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 })
    }
    const raw = await request.json()
    const parsed = CreateChatSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "请求参数校验失败", details: parsed.error.issues },
        { status: 400 },
      )
    }
    const body = parsed.data
    const now = new Date()
    const chat = {
      id: crypto.randomUUID(),
      title: body.title ?? "新对话",
      agentId: body.agentId ?? "chatAgent",
      modelId: body.modelId ?? null,
      userId: user.id,
      createdAt: now,
      updatedAt: now,
    }
    await db.insert(chats).values(chat)
    return NextResponse.json(chat, { status: 201 })
  } catch (error) {
    console.error("创建对话失败:", error)
    return NextResponse.json({ error: "创建对话失败" }, { status: 500 })
  }
}
