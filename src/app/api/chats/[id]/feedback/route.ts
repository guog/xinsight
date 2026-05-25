import { NextResponse } from "next/server"
import { db } from "@/db"
import { messageFeedbacks } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { withAuth } from "@/lib/with-auth"
import { getOwnedChat } from "@/lib/chat-ownership"
import { randomUUID } from "node:crypto"

/** GET /api/chats/[id]/feedback — 获取对话所有消息的反馈 */
export const GET = withAuth(async (user, _request, context) => {
  const { id } = await (context as { params: Promise<{ id: string }> }).params
  const chat = getOwnedChat(id, user.id)
  if (!chat) {
    return NextResponse.json({ error: "对话不存在" }, { status: 404 })
  }
  const feedbacks = await db
    .select()
    .from(messageFeedbacks)
    .where(and(eq(messageFeedbacks.chatId, id), eq(messageFeedbacks.userId, user.id)))
  return NextResponse.json(feedbacks)
})

/** POST /api/chats/[id]/feedback — 提交或更新消息反馈 */
export const POST = withAuth(async (user, request, context) => {
  const { id } = await (context as { params: Promise<{ id: string }> }).params
  const chat = getOwnedChat(id, user.id)
  if (!chat) {
    return NextResponse.json({ error: "对话不存在" }, { status: 404 })
  }

  const body = await request.json()
  const { messageId, type, comment } = body as {
    messageId: string
    type: "up" | "down"
    comment?: string
  }

  if (!messageId || !["up", "down"].includes(type)) {
    return NextResponse.json({ error: "参数错误" }, { status: 400 })
  }

  const existing = await db
    .select()
    .from(messageFeedbacks)
    .where(and(eq(messageFeedbacks.messageId, messageId), eq(messageFeedbacks.userId, user.id)))

  if (existing.length > 0) {
    if (existing[0].type === type) {
      await db.delete(messageFeedbacks).where(eq(messageFeedbacks.id, existing[0].id))
      return NextResponse.json({ action: "removed" })
    }
    await db
      .update(messageFeedbacks)
      .set({ type, comment: comment ?? null })
      .where(eq(messageFeedbacks.id, existing[0].id))
    return NextResponse.json({ action: "updated", type })
  }

  const feedback = {
    id: randomUUID(),
    messageId,
    chatId: id,
    userId: user.id,
    type,
    comment: comment ?? null,
    createdAt: new Date(),
  }
  await db.insert(messageFeedbacks).values(feedback)
  return NextResponse.json({ action: "created", type })
})
