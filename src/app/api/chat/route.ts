import { createUIMessageStream, createUIMessageStreamResponse } from "ai"
import type { UIMessage } from "ai"
import { toAISdkStream } from "@mastra/ai-sdk"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"

import { mastra } from "@/mastra"
import { buildDatasourceContext } from "@/lib/schema/build-context"
import { getProviderForModel, getModelById, getDefaultModelId } from "@/lib/models"
import { db } from "@/db"
import { chats, messages } from "@/db/schema"
import { eq } from "drizzle-orm"

// 允许流式响应最长 60 秒
export const maxDuration = 60

export async function POST(req: Request) {
  const {
    messages: chatMessages,
    agentId = "chatAgent",
    chatId,
    modelId,
  }: {
    messages: UIMessage[]
    agentId?: string
    chatId?: string
    modelId?: string
  } = await req.json()

  // 动态构建模型实例
  const effectiveModelId = modelId || getDefaultModelId()
  const provider = getProviderForModel(effectiveModelId)
  const modelInfo = getModelById(effectiveModelId)
  let modelInstance = undefined
  if (provider && modelInfo) {
    const client = createOpenAICompatible({
      name: provider.id,
      baseURL: provider.baseUrl,
      apiKey: provider.apiKey,
    })
    modelInstance = client.chatModel(modelInfo.modelSlug)
  }

  const agent = mastra.getAgent(
    agentId as "chatAgent" | "researchAgent" | "codeAgent" | "autoAgent",
  )

  // 注入数据源上下文到系统消息
  const dsContext = await buildDatasourceContext(agentId)
  const messagesWithContext = dsContext
    ? [
        {
          role: "system" as const,
          content: `\n\n---\n可用数据源:\n${dsContext}\n---\n`,
        },
        ...chatMessages,
      ]
    : chatMessages

  const stream = await agent.stream(messagesWithContext, { model: modelInstance })

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
            // onConflictDoNothing: 客户端重试时同一消息 ID 不重复保存（预期行为）
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
            // 前两条消息（user + assistant），用用户消息前 30 字作为标题
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
