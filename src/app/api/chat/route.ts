import { createUIMessageStream, createUIMessageStreamResponse } from "ai"
import type { UIMessage } from "ai"
import { toAISdkStream } from "@mastra/ai-sdk"

import { mastra } from "@/mastra"
import { persistMessages, autoGenerateTitle } from "@/db/repositories/chat-repo"

// 允许流式响应最长 120 秒（Supervisor 多轮调度可能需要更长时间）
export const maxDuration = 120

export async function POST(req: Request) {
  const {
    messages: chatMessages,
    chatId,
    agentId,
  }: {
    messages: UIMessage[]
    chatId?: string
    agentId?: string
  } = await req.json()

  // 根据请求选择 Agent，默认使用厂长 Supervisor
  const agent = mastra.getAgent(agentId || "factoryDirectorAgent")

  const stream = await agent.stream(chatMessages)

  // 收集完整的 assistant 响应
  let assistantText = ""

  const uiMessageStream = createUIMessageStream({
    originalMessages: chatMessages,
    execute: async ({ writer }) => {
      const reader = toAISdkStream(stream, {
        from: "agent",
        version: "v6",
        sendReasoning: true,
      }).getReader()

      // 过滤掉大量冗余的 data-tool-agent / rest 中间态事件
      // 这些事件每个 token 发一次完整 agent state，导致浏览器 OOM
      const BLOCKED_TYPES = new Set(["data-tool-agent", "rest"])

      try {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const chunk = value as any
          // 跳过冗余中间态事件
          if (BLOCKED_TYPES.has(chunk.type)) continue
          // 收集文本用于持久化
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
          const lastUserMsg = chatMessages[chatMessages.length - 1]
          await persistMessages(chatId, lastUserMsg, assistantText)
          await autoGenerateTitle(chatId, lastUserMsg)
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
