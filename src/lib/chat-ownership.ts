import { db } from "@/db"
import { chats } from "@/db/schema"
import { eq, and } from "drizzle-orm"

/**
 * 验证对话所有权，返回对话记录或 undefined
 * 统一提取，避免在多个 route 中重复定义
 */
export async function getOwnedChat(chatId: string, userId: string) {
  return db
    .select()
    .from(chats)
    .where(and(eq(chats.id, chatId), eq(chats.userId, userId)))
    .get()
}
