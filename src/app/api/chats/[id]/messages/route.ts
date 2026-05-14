import { NextResponse } from "next/server"
import { db } from "@/db"
import { chats, messages } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { requireAuth, handleAuthError } from "@/lib/auth"

/** 验证对话所有权 */
async function verifyOwnership(chatId: string, userId: string) {
  return db
    .select()
    .from(chats)
    .where(and(eq(chats.id, chatId), eq(chats.userId, userId)))
    .get()
}

/** GET /api/chats/[id]/messages — 获取对话的所有消息 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    let user
    try {
      user = await requireAuth()
    } catch (error) {
      return handleAuthError(error)
    }

    const { id } = await params
    const chat = await verifyOwnership(id, user.id)
    if (!chat) {
      return NextResponse.json({ error: "对话不存在" }, { status: 404 })
    }

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
    let user
    try {
      user = await requireAuth()
    } catch (error) {
      return handleAuthError(error)
    }

    const { id } = await params
    const chat = await verifyOwnership(id, user.id)
    if (!chat) {
      return NextResponse.json({ error: "对话不存在" }, { status: 404 })
    }

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
