import { NextResponse } from "next/server"
import { db } from "@/db"
import { chats } from "@/db/schema"
import { desc } from "drizzle-orm"

/** GET /api/chats — 获取所有对话列表 */
export async function GET() {
  try {
    const list = await db.select().from(chats).orderBy(desc(chats.updatedAt))
    return NextResponse.json(list)
  } catch (error) {
    console.error("获取对话列表失败:", error)
    return NextResponse.json({ error: "获取对话列表失败" }, { status: 500 })
  }
}

/** POST /api/chats — 创建新对话 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const now = new Date()
    const chat = {
      id: crypto.randomUUID(),
      title: body.title ?? "新对话",
      agentId: body.agentId ?? "chatAgent",
      modelId: body.modelId ?? null,
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
