import { NextResponse } from "next/server"
import { db } from "@/db"
import { messages } from "@/db/schema"
import { eq } from "drizzle-orm"
import { withAuth } from "@/lib/with-auth"
import { getOwnedChat } from "@/lib/chat-ownership"
import { CreateMessageSchema } from "@/lib/api-schemas"

/** GET /api/chats/[id]/messages — 获取对话的所有消息 */
export const GET = withAuth(async (user, _request, context) => {
  const { id } = await (context as { params: Promise<{ id: string }> }).params
  const chat = await getOwnedChat(id, user.id)
  if (!chat) {
    return NextResponse.json({ error: "对话不存在" }, { status: 404 })
  }

  const list = await db
    .select()
    .from(messages)
    .where(eq(messages.chatId, id))
    .orderBy(messages.createdAt)
  return NextResponse.json(list)
})

/** POST /api/chats/[id]/messages — 保存消息 */
export const POST = withAuth(async (user, request, context) => {
  const { id } = await (context as { params: Promise<{ id: string }> }).params
  const chat = await getOwnedChat(id, user.id)
  if (!chat) {
    return NextResponse.json({ error: "对话不存在" }, { status: 404 })
  }

  const body = await request.json()

  // Zod 校验：role 限定 user/assistant，parts 限 100KB，忽略客户端 id
  const parsed = CreateMessageSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "输入校验失败", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  const message = {
    id: crypto.randomUUID(),
    chatId: id,
    role: parsed.data.role,
    parts:
      typeof parsed.data.parts === "string" ? parsed.data.parts : JSON.stringify(parsed.data.parts),
    createdAt: new Date(),
  }
  await db.insert(messages).values(message)
  return NextResponse.json(message, { status: 201 })
})
