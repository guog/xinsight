import { NextResponse } from "next/server"
import { db } from "@/db"
import { chats, messages } from "@/db/schema"
import { eq } from "drizzle-orm"
import { withAuth } from "@/lib/with-auth"
import { getOwnedChat } from "@/lib/chat-ownership"
import { UpdateChatSchema } from "@/lib/api-schemas"

/** GET /api/chats/[id] — 获取单个对话及其消息 */
export const GET = withAuth(async (user, _request, context) => {
  const { id } = await (context as { params: Promise<{ id: string }> }).params
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
})

/** PATCH /api/chats/[id] — 更新对话信息 */
export const PATCH = withAuth(async (user, request, context) => {
  const { id } = await (context as { params: Promise<{ id: string }> }).params
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
})

/** DELETE /api/chats/[id] — 删除对话 */
export const DELETE = withAuth(async (user, _request, context) => {
  const { id } = await (context as { params: Promise<{ id: string }> }).params
  const chat = await getOwnedChat(id, user.id)
  if (!chat) {
    return NextResponse.json({ error: "对话不存在" }, { status: 404 })
  }

  await db.delete(chats).where(eq(chats.id, id))
  return NextResponse.json({ success: true })
})
