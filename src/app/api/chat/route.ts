import { createUIMessageStream, createUIMessageStreamResponse } from "ai"
import type { UIMessage } from "ai"
import { toAISdkStream } from "@mastra/ai-sdk"

import { mastra } from "@/mastra"
import { db } from "@/db"
import { chats, messages } from "@/db/schema"
import { eq } from "drizzle-orm"

// 允许流式响应最长 120 秒（Supervisor 多轮调度可能需要更长时间）
export const maxDuration = 120

export async function POST(req: Request) {
  const {
    messages: chatMessages,
    chatId,
  }: {
    messages: UIMessage[]
    chatId?: string
  } = await req.json()

  // 始终使用厂长 Supervisor Agent — 用户无需选择
  const agent = mastra.getAgent("factoryDirectorAgent")

  const stream = await agent.stream(chatMessages)

  // 收集完整的 assistant 响应
  let assistantText = ""

  const uiMessageStream = createUIMessageStream({
    originalMessages: chatMessages,
    execute: async ({ writer }) => {
      const reader = toAISdkStream(stream, { from: "agent", version: "v6" }).getReader()
      try {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          // 收集文本用于持久化
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const chunk = value as any
          if (chunk.type === "text-delta") {
            const text = chunk.delta ?? chunk.value ?? ""
            if (typeof text === "string") {
              assistantText += text
            }
          }
          await writer.write(value)
        }
      } finally {
        reader.releaseLock()
      }

      // 流结束后持久化消息
      if (chatId && assistantText) {
        try {
          // 保存用户最后一条消息
          const lastUserMsg = chatMessages[chatMessages.length - 1]
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

          // 更新对话时间；如果是第一条消息，用用户消息自动生成标题
          const updates: Record<string, unknown> = { updatedAt: new Date() }
          const msgCount = await db.select().from(messages).where(eq(messages.chatId, chatId))
          if (msgCount.length <= 2 && lastUserMsg) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const textPart = (lastUserMsg.parts as any[])?.find((p) => p.type === "text")
            const firstText = textPart?.text as string | undefined
            if (firstText) {
              updates.title = firstText.slice(0, 30) + (firstText.length > 30 ? "..." : "")
            }
          }
          await db.update(chats).set(updates).where(eq(chats.id, chatId))
        } catch (e) {
          console.error("持久化消息失败:", e)
        }
      }
    },
  })

  return createUIMessageStreamResponse({
    stream: uiMessageStream,
  })
}
