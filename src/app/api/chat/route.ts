import { createUIMessageStream, createUIMessageStreamResponse } from "ai"
import type { UIMessage } from "ai"
import { toAISdkStream } from "@mastra/ai-sdk"

import { mastra } from "@/mastra"
import { persistMessages, autoGenerateTitle } from "@/db/repositories/chat-repo"
import { buildDatasourceContext } from "@/lib/schema/build-context"
import { requireAuth, handleAuthError } from "@/lib/auth"
import { isRetryableError } from "@/lib/retry-utils"

// 允许流式响应最长 120 秒（Supervisor 多轮调度可能需要更长时间）
export const maxDuration = 120

export async function POST(req: Request) {
  try {
    // 认证检查：未登录返回 401
    let user
    try {
      user = await requireAuth()
    } catch (error) {
      return handleAuthError(error)
    }

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

    // Memory 需要 resourceId + threadId 来关联对话上下文（使用真实用户 ID 实现隔离）
    const memoryOptions = chatId ? { resourceId: user.id, threadId: chatId } : undefined

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
      // 仅对可重试错误（速率限制、超时、网络错误）进行重试
      if (isRetryableError(e)) {
        console.warn("[chat] 可重试错误，1秒后重试...", e)
        await new Promise((r) => setTimeout(r, 1000))
        stream = await agent.stream(chatMessages, {
          ...memoryOptions,
          ...(contextSuffix ? { instructions: contextSuffix } : {}),
        })
      } else {
        throw e
      }
    }

    // 收集完整的 assistant 响应部分（文本 + 思考过程 + 工具调用）
    let assistantText = ""
    let reasoningText = ""

    const toolCalls = new Map<string, { toolName: string; input?: unknown; output?: unknown }>()

    const uiMessageStream = createUIMessageStream({
      originalMessages: chatMessages,
      execute: async ({ writer }) => {
        const reader = toAISdkStream(stream, {
          from: "agent",
          version: "v6",
          sendReasoning: true,
        }).getReader()

        // 过滤冗余事件（性能关键）：
        // - data-tool-agent / rest：每 token 发完整 agent state，导致浏览器 OOM（PR #56）
        // - tool-input-delta：partial JSON 流，多 Agent 并行时产生海量碎片，前端仅需 start + available
        const BLOCKED_TYPES = new Set(["data-tool-agent", "rest", "tool-input-delta"])

        try {
          const seenTypes = new Set<string>()
          for (;;) {
            const { done, value } = await reader.read()
            if (done) break
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const chunk = value as any
            if (!seenTypes.has(chunk.type)) {
              seenTypes.add(chunk.type)
              console.log("[chat] chunk type:", chunk.type, "keys:", Object.keys(chunk).join(","))
            }
            // 跳过冗余中间态事件
            if (BLOCKED_TYPES.has(chunk.type)) continue
            // 收集文本和推理用于持久化
            if (chunk.type === "text-delta") {
              const text = chunk.delta ?? chunk.value ?? ""
              if (typeof text === "string") {
                assistantText += text
              }
            } else if (chunk.type === "reasoning-delta" || chunk.type === "reasoning") {
              const text = chunk.delta ?? chunk.value ?? chunk.text ?? ""
              if (typeof text === "string") {
                reasoningText += text
              }
            } else if (chunk.type === "tool-input-start" || chunk.type === "tool-input-available") {
              // 收集工具调用输入
              const id = chunk.toolCallId as string
              if (!toolCalls.has(id)) {
                toolCalls.set(id, { toolName: chunk.toolName ?? "" })
              }
              if (chunk.type === "tool-input-available" && chunk.input !== undefined) {
                const entry = toolCalls.get(id)!
                entry.input = chunk.input
                if (chunk.toolName) entry.toolName = chunk.toolName
              }
            } else if (chunk.type === "tool-output-available") {
              // 收集工具调用输出
              const id = chunk.toolCallId as string
              const entry = toolCalls.get(id)
              if (entry) {
                entry.output = chunk.output
              }
            }
            await writer.write(value)
          }
        } finally {
          reader.releaseLock()
        }

        // 流结束后持久化消息（即使没有 text，有 tool-call 也要保存）
        console.log(
          "[chat] stream done, chatId:",
          chatId,
          "assistantText length:",
          assistantText.length,
          "lastUserMsg:",
          chatMessages[chatMessages.length - 1]?.role,
        )
        if (chatId && (assistantText || toolCalls.size > 0)) {
          try {
            const lastUserMsg = chatMessages[chatMessages.length - 1]
            // 构建完整的 assistant parts 数组
            const assistantParts = buildAssistantParts(reasoningText, assistantText, toolCalls)
            await persistMessages(chatId, lastUserMsg, assistantParts)
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

/**
 * 从收集到的流数据构建完整的 assistant parts 数组
 * 顺序：reasoning → tool-calls → text（与 AI SDK v6 UIMessage 结构一致）
 */
function buildAssistantParts(
  reasoningText: string,
  assistantText: string,
  toolCalls: Map<string, { toolName: string; input?: unknown; output?: unknown }>,
): Array<Record<string, unknown>> {
  const parts: Array<Record<string, unknown>> = []

  if (reasoningText.trim()) {
    parts.push({ type: "reasoning", text: reasoningText, state: "done" })
  }

  for (const [toolCallId, tc] of toolCalls) {
    parts.push({
      type: `tool-${tc.toolName}`,
      toolCallId,
      toolName: tc.toolName,
      state: tc.output !== undefined ? "output-available" : "input-available",
      input: tc.input,
      output: tc.output,
    })
  }

  if (assistantText) {
    parts.push({ type: "text", text: assistantText })
  }

  return parts
}
