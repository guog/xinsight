import { createUIMessageStream, createUIMessageStreamResponse } from "ai"
import type { UIMessage } from "ai"
import { toAISdkStream } from "@mastra/ai-sdk"

import { mastra } from "@/mastra"
import { persistMessages, autoGenerateTitle } from "@/db/repositories/chat-repo"
import { buildDatasourceContext } from "@/lib/schema/build-context"
import { requireAuth, handleAuthError } from "@/lib/auth"
import { isRetryableError } from "@/lib/retry-utils"
import { buildAssistantParts } from "@/lib/chat-utils"
import {
  classifyIntent,
  buildWorkerList,
  buildSupervisorInstructions,
} from "@/mastra/agents/supervisor-router"
import { db } from "@/db"
import { SqliteAgentRepository } from "@/db/repositories/agent-repository"

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

    if (modelId && process.env.NODE_ENV === "development")
      console.log("[chat] modelId requested:", modelId)

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

    // Supervisor 动态路由：加载 DB 中启用的 Agent 列表，生成路由提示
    let dynamicInstructions = ""
    const isSupervisor =
      !agentId || agentId === "factoryDirectorAgent" || agentId === "factory-director"
    if (isSupervisor) {
      try {
        const agentRepo = new SqliteAgentRepository(db)
        const enabledAgents = await agentRepo.findEnabled()
        const workers = buildWorkerList(enabledAgents)
        const lastUserMessage = chatMessages[chatMessages.length - 1]
        const userQuery =
          lastUserMessage?.parts
            ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
            .map((p) => p.text)
            .join(" ") ?? ""
        const routed = classifyIntent(userQuery, workers)
        const routingHint = routed.some((r) => r.id === "chat-agent")
          ? undefined
          : routed.map((r) => `- **${r.name}**（${r.id}）`).join("\n")
        dynamicInstructions = buildSupervisorInstructions(workers, routingHint)
      } catch (e) {
        console.warn("[chat] 动态路由降级:", e)
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let stream: any
    const MAX_RETRIES = 3
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        stream = await agent.stream(chatMessages, {
          ...memoryOptions,
          ...(dynamicInstructions || contextSuffix
            ? { instructions: (dynamicInstructions || "") + contextSuffix }
            : {}),
        })
        break
      } catch (e) {
        if (isRetryableError(e) && attempt < MAX_RETRIES) {
          // 指数退避 + jitter：1s, 2s, 4s（±25%）
          const baseDelay = 1000 * Math.pow(2, attempt)
          const jitter = baseDelay * 0.25 * (Math.random() * 2 - 1)
          const delay = Math.round(baseDelay + jitter)
          console.warn(`[chat] 可重试错误，${delay}ms 后重试 (${attempt + 1}/${MAX_RETRIES})...`, e)
          await new Promise((r) => setTimeout(r, delay))
          continue
        }
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
        // - rest：每 token 发完整 agent state，导致浏览器 OOM（PR #56）
        // - tool-input-delta：partial JSON 流，多 Agent 并行时产生海量碎片，前端仅需 start + available
        // - data-tool-agent：完整累积状态，替换为轻量 delta 转发（见下方处理逻辑）
        const BLOCKED_TYPES = new Set(["rest", "tool-input-delta"])

        // 子 Agent 流式进度：记录已发送的文本长度，仅发送增量（key = runId）
        const agentTextOffsets = new Map<string, number>()

        try {
          const seenTypes = new Set<string>()
          for (;;) {
            const { done, value } = await reader.read()
            if (done) break
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const chunk = value as any
            if (!seenTypes.has(chunk.type) && process.env.NODE_ENV === "development") {
              seenTypes.add(chunk.type)
              console.log("[chat] chunk type:", chunk.type, "keys:", Object.keys(chunk).join(","))
            } else {
              seenTypes.add(chunk.type)
            }
            // 跳过冗余中间态事件
            if (BLOCKED_TYPES.has(chunk.type)) continue

            // data-tool-agent：提取文本增量，转为轻量 transient 事件，丢弃原始重型数据
            if (chunk.type === "data-tool-agent") {
              const runId = chunk.id as string
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const data = chunk.data as Record<string, any>
              const fullText = (data?.text as string) ?? ""
              const prevOffset = agentTextOffsets.get(runId) ?? 0
              if (process.env.NODE_ENV === "development" && prevOffset === 0) {
                console.log(
                  "[chat] data-tool-agent first chunk, id:",
                  runId,
                  "data.id:",
                  data?.id,
                  "data keys:",
                  Object.keys(data ?? {}),
                )
              }
              if (fullText.length > prevOffset) {
                const delta = fullText.slice(prevOffset)
                agentTextOffsets.set(runId, fullText.length)
                // 使用 runId 作为 key（前端通过 toolCallId 匹配，若不匹配则回退到 toolName）
                await writer.write({
                  type: "data-agent-progress",
                  id: runId,
                  data: {
                    runId,
                    toolCallId: data?.id ?? runId,
                    textDelta: delta,
                  },
                  transient: true,
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } as any)
              }
              continue
            }
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
        if (process.env.NODE_ENV === "development") {
          console.log(
            "[chat] stream done, chatId:",
            chatId,
            "assistantText length:",
            assistantText.length,
            "lastUserMsg:",
            chatMessages[chatMessages.length - 1]?.role,
          )
        }
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
