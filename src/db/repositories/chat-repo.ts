import type { UIMessage } from "ai"
import { count, eq } from "drizzle-orm"

import { db } from "@/db"
import { chats, messages } from "@/db/schema"

/**
 * 持久化用户消息和 assistant 回复到数据库
 */
export async function persistMessages(
  chatId: string,
  lastUserMsg: UIMessage | undefined,
  assistantText: string,
) {
  // 保存用户最后一条消息
  if (lastUserMsg && lastUserMsg.role === "user") {
    await db
      .insert(messages)
      .values({
        id: lastUserMsg.id,
        chatId,
        role: "user",
        parts: JSON.stringify(lastUserMsg.parts),
        createdAt: new Date(),
      })
      .onConflictDoNothing()
  }

  // 保存 assistant 消息
  await db.insert(messages).values({
    id: crypto.randomUUID(),
    chatId,
    role: "assistant",
    parts: JSON.stringify([{ type: "text", text: assistantText }]),
    createdAt: new Date(),
  })
}

/**
 * 如果是第一条消息，用用户消息自动生成标题并更新对话
 */
export async function autoGenerateTitle(chatId: string, lastUserMsg: UIMessage | undefined) {
  const updates: Record<string, unknown> = { updatedAt: new Date() }

  const [{ count: msgCount }] = await db
    .select({ count: count() })
    .from(messages)
    .where(eq(messages.chatId, chatId))

  if (msgCount <= 2 && lastUserMsg) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const textPart = (lastUserMsg.parts as any[])?.find((p) => p.type === "text")
    const firstText = textPart?.text as string | undefined
    if (firstText) {
      updates.title = firstText.slice(0, 30) + (firstText.length > 30 ? "..." : "")
    }
  }

  await db.update(chats).set(updates).where(eq(chats.id, chatId))
}
