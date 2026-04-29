import { NextResponse } from "next/server"
import { db } from "@/db"
import { chats, messages } from "@/db/schema"
import { eq, desc } from "drizzle-orm"

/** GET /api/chats/[id] — 获取单个对话及其消息 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const chat = await db.select().from(chats).where(eq(chats.id, id)).get()
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
    const { id } = await params
    const body = await request.json()
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
    const { id } = await params
    await db.delete(chats).where(eq(chats.id, id))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("删除对话失败:", error)
    return NextResponse.json({ error: "删除对话失败" }, { status: 500 })
  }
}
