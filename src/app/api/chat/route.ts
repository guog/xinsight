import { createUIMessageStream, createUIMessageStreamResponse } from "ai"
import type { UIMessage } from "ai"
import { toAISdkStream } from "@mastra/ai-sdk"

import { mastra } from "@/mastra"
import { persistMessages, autoGenerateTitle } from "@/db/repositories/chat-repo"
import { buildDatasourceContext } from "@/lib/schema/build-context"

// 允许流式响应最长 120 秒（Supervisor 多轮调度可能需要更长时间）
export const maxDuration = 120

export async function POST(req: Request) {
  try {
    const {
      messages: chatMessages,
      chatId,
      agentId,
      modelId,
    }: {
      messages: UIMessage[]
      chatId?: string
      agentId?: string
      modelId?: string
    } = await req.json()

    if (modelId) console.log("[chat] modelId requested:", modelId)

    // 根据请求选择 Agent，默认使用厂长 Supervisor
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const agent = mastra.getAgent((agentId || "factoryDirectorAgent") as any)

    // Memory 需要 resourceId + threadId 来关联对话上下文
    const memoryOptions = chatId ? { resourceId: "user", threadId: chatId } : undefined

    // 动态注入数据源上下文到 Agent 提示词
    let datasourceContext = ""
    try {
      datasourceContext = await buildDatasourceContext(agentId || "factoryDirectorAgent")
    } catch {
      // 降级处理：DB 查询失败时不影响对话
    }
    const contextSuffix = datasourceContext
      ? `\n\n## 当前可用数据源\n以下是你可以查询的数据源和接口，直接使用 datasource-query 调用，无需先调用 datasource-list：\n${datasourceContext}`
      : ""

    let stream
    try {
      stream = await agent.stream(chatMessages, {
        ...memoryOptions,
        ...(contextSuffix ? { instructions: contextSuffix } : {}),
      })
    } catch (e) {
      console.warn("[chat] first attempt failed, retrying...", e)
      await new Promise((r) => setTimeout(r, 1000))
      stream = await agent.stream(chatMessages, {
        ...memoryOptions,
        ...(contextSuffix ? { instructions: contextSuffix } : {}),
      })
    }

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
  } catch (error) {
    console.error("[chat] unhandled error:", error)
    return Response.json({ error: "服务器内部错误，请稍后重试" }, { status: 500 })
  }
}
