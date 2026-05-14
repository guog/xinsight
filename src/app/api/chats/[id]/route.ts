import { NextResponse } from "next/server"
import { db } from "@/db"
import { chats, messages } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { requireAuth, handleAuthError } from "@/lib/auth"
import { UpdateChatSchema } from "@/lib/api-schemas"

/** 验证对话所有权，返回对话或 null */
async function getOwnedChat(chatId: string, userId: string) {
  return db
    .select()
    .from(chats)
    .where(and(eq(chats.id, chatId), eq(chats.userId, userId)))
    .get()
}

/** GET /api/chats/[id] — 获取单个对话及其消息 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    let user
    try {
      user = await requireAuth()
    } catch (error) {
      return handleAuthError(error)
    }

    const { id } = await params
    const chat = await getOwnedChat(id, user.id)
    if (!chat) {
      return NextResponse.json({ error: "对话不存在" }, { status: 404 })
    }
    const chatMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.chatId, id))
      .orderBy(messages.createdAt)
    return NextResponse.json({ ...chat, messages: chatMessages })
  } catch (error) {
    console.error("获取对话详情失败:", error)
    return NextResponse.json({ error: "获取对话详情失败" }, { status: 500 })
  }
}

/** PATCH /api/chats/[id] — 更新对话信息 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    let user
    try {
      user = await requireAuth()
    } catch (error) {
      return handleAuthError(error)
    }

    const { id } = await params
    const chat = await getOwnedChat(id, user.id)
    if (!chat) {
      return NextResponse.json({ error: "对话不存在" }, { status: 404 })
    }

    const raw = await request.json()
    const parsed = UpdateChatSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "请求参数校验失败", details: parsed.error.issues },
        { status: 400 },
      )
    }
    const body = parsed.data
    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (body.title !== undefined) updates.title = body.title
    if (body.agentId !== undefined) updates.agentId = body.agentId
    if (body.modelId !== undefined) updates.modelId = body.modelId
    const result = await db.update(chats).set(updates).where(eq(chats.id, id)).returning()
    if (!result.length) {
      return NextResponse.json({ error: "对话不存在" }, { status: 404 })
    }
    return NextResponse.json(result[0])
  } catch (error) {
    console.error("更新对话失败:", error)
    return NextResponse.json({ error: "更新对话失败" }, { status: 500 })
  }
}

/** DELETE /api/chats/[id] — 删除对话 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    let user
    try {
      user = await requireAuth()
    } catch (error) {
      return handleAuthError(error)
    }

    const { id } = await params
    const chat = await getOwnedChat(id, user.id)
    if (!chat) {
      return NextResponse.json({ error: "对话不存在" }, { status: 404 })
    }

    await db.delete(chats).where(eq(chats.id, id))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("删除对话失败:", error)
    return NextResponse.json({ error: "删除对话失败" }, { status: 500 })
  }
}
