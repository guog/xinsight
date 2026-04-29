import { NextResponse } from "next/server"
import { db } from "@/db"
import { messages } from "@/db/schema"
import { eq } from "drizzle-orm"

/** GET /api/chats/[id]/messages — 获取对话的所有消息 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const list = await db
      .select()
      .from(messages)
      .where(eq(messages.chatId, id))
      .orderBy(messages.createdAt)
    return NextResponse.json(list)
  } catch (error) {
    console.error("获取消息列表失败:", error)
    return NextResponse.json({ error: "获取消息列表失败" }, { status: 500 })
  }
}

/** POST /api/chats/[id]/messages — 保存消息 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const message = {
      id: body.id ?? crypto.randomUUID(),
      chatId: id,
      role: body.role,
      parts: typeof body.parts === "string" ? body.parts : JSON.stringify(body.parts),
      createdAt: new Date(),
    }
    await db.insert(messages).values(message)
    return NextResponse.json(message, { status: 201 })
  } catch (error) {
    console.error("保存消息失败:", error)
    return NextResponse.json({ error: "保存消息失败" }, { status: 500 })
  }
}
