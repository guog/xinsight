import type { UIMessage } from "ai"
import { generateText } from "ai"
import { count, eq } from "drizzle-orm"

import { db } from "@/db"
import { chats, messages } from "@/db/schema"
import { wikiLLMProvider } from "@/lib/wiki/llm"

/**
 * 持久化用户消息和 assistant 回复到数据库
 * assistantParts: 完整的 parts 数组（reasoning + tool-call + text）
 */
export async function persistMessages(
  chatId: string,
  lastUserMsg: UIMessage | undefined,
  assistantParts: Array<Record<string, unknown>>,
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

  // 保存 assistant 消息（完整 parts 包含 reasoning + tool-calls + text）
  await db.insert(messages).values({
    id: crypto.randomUUID(),
    chatId,
    role: "assistant",
    parts: JSON.stringify(assistantParts),
    createdAt: new Date(),
  })
}

/**
 * 如果是第一条消息，用 LLM 自动总结对话标题
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
      try {
        // 使用 deepseek-chat（非推理模型）生成标题，避免推理模型把 token 全用在思考上
        const { text: title } = await generateText({
          model: wikiLLMProvider("deepseek-chat"),
          maxOutputTokens: 50,
          prompt: `为以下用户消息生成一个简短的对话标题（不超过15个字，不要引号和标点）：\n${firstText.slice(0, 200)}`,
        })
        updates.title = title
          .trim()
          .replace(/^["'「]|["'」]$/g, "")
          .slice(0, 30)
      } catch (e) {
        console.error("LLM 生成标题失败，降级为截取:", e)
        updates.title = firstText.slice(0, 30) + (firstText.length > 30 ? "..." : "")
      }
    }
  }

  await db.update(chats).set(updates).where(eq(chats.id, chatId))
}
