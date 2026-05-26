import { createUIMessageStream, createUIMessageStreamResponse } from "ai"
import type { UIMessage } from "ai"
import { toAISdkStream } from "@mastra/ai-sdk"
import { NextResponse } from "next/server"

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
import { buildDynamicTools } from "@/mastra/tools/datasource/build-dynamic-tools"

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

    const resolvedAgentId = agentId || "factoryDirectorAgent"

    // 细粒度 RBAC 鉴权：校验用户对当前请求的 Agent 是否有使用权限
    let agentRepo: any
    try {
      agentRepo = new SqliteAgentRepository(db)
    } catch {
      agentRepo = (SqliteAgentRepository as any)(db)
    }
    const authorizedAgents =
      typeof agentRepo.getAuthorizedAgentsForUser === "function"
        ? await agentRepo.getAuthorizedAgentsForUser(user.id, user.role)
        : []

    // 自动豁免/放行在代码中注册但未 seed 进数据库 customAgents 表的内置 Agent
    for (const [_, bAgent] of Object.entries(mastra?.agents || {})) {
      const agentIdKey = bAgent.id
      const existsInAuthorized = authorizedAgents.some((a) => a.id === agentIdKey)
      if (!existsInAuthorized) {
        const agentInDb =
          typeof agentRepo.findById === "function" ? await agentRepo.findById(agentIdKey) : null
        if (!agentInDb) {
          authorizedAgents.push({
            id: agentIdKey,
            name: bAgent.name || agentIdKey,
            description: (bAgent as any).description || null,
            systemPrompt: (bAgent as any).instructions || "",
            modelId: null,
            icon: null,
            isBuiltin: true,
            enabled: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
        }
      }
    }

    let authorizedAgentIds = new Set(authorizedAgents.map((a) => a.id))

    // 额外兜底：如果 resolvedAgentId 依然不在可访问列表中，但 mastra 能够成功实例化该 Agent，
    // 并且数据库里不存在该 Agent 相关的限制（即 findById 找不到记录），则默认放行并追加至 authorizedAgents 中
    if (!authorizedAgentIds.has(resolvedAgentId)) {
      try {
        const hasAgentInstance =
          mastra &&
          typeof mastra.getAgent === "function" &&
          !!mastra.getAgent(resolvedAgentId as any)
        if (hasAgentInstance) {
          const agentInDb =
            typeof agentRepo.findById === "function"
              ? await agentRepo.findById(resolvedAgentId)
              : null
          if (!agentInDb) {
            authorizedAgents.push({
              id: resolvedAgentId,
              name: resolvedAgentId,
              description: null,
              systemPrompt: "",
              modelId: null,
              icon: null,
              isBuiltin: true,
              enabled: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            authorizedAgentIds = new Set(authorizedAgents.map((a) => a.id))
          }
        }
      } catch {
        // 忽略
      }
    }

    if (!authorizedAgentIds.has(resolvedAgentId)) {
      return NextResponse.json({ error: "无权访问此 Agent" }, { status: 403 })
    }

    // 根据请求选择 Agent，使用经过鉴权的 AgentId
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const agent = mastra.getAgent(resolvedAgentId as any)

    // Memory 需要 resourceId + threadId 来关联对话上下文（使用真实用户 ID 实现隔离）
    const memoryOptions = chatId ? { resourceId: user.id, threadId: chatId } : undefined

    // 动态注入数据源上下文到 Agent 提示词
    let datasourceContext = ""
    try {
      datasourceContext = await buildDatasourceContext(resolvedAgentId)
    } catch {
      // 降级处理：DB 查询失败时不影响对话
    }
    const contextSuffix = datasourceContext
      ? `\n\n## 当前可用数据源\n以下数据源已注册为独立工具，直接按工具名调用即可（格式：数据源ID--端点ID）：\n${datasourceContext}`
      : ""

    // Supervisor 动态路由：加载当前用户有权使用的子 Agent 列表，生成路由提示
    let dynamicInstructions = ""
    const isSupervisor =
      !agentId || agentId === "factoryDirectorAgent" || agentId === "factory-director"
    if (isSupervisor) {
      try {
        const workers = buildWorkerList(authorizedAgents)
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

    // 动态工具注册：基于 Agent-Endpoint 绑定生成 per-endpoint 工具
    let dynamicToolset: Record<string, unknown> = {}
    try {
      dynamicToolset = await buildDynamicTools(resolvedAgentId)
    } catch (e) {
      console.warn("[chat] 动态工具注册降级:", e)
    }

    const CONFIRMATION_INSTRUCTIONS = `

## 数据源写入二次确认协议
当调用某个数据源写操作工具时，如果工具返回 \`{"success": false, "error": "CONFIRMATION_REQUIRED", "metadata": ...}\`，这意味着该写操作需要用户的二次确认。
此时，你应当停止后续执行，直接向用户解释该操作需要他确认（例如说：“此操作需要您的确认，请在下方点击确认以执行该写入操作”），不要向用户报错，也不要尝试重新调用该工具。前端界面会自动识别 metadata 并显示确认按钮。
`

    const baseInstructions = agent?.instructions || ""
    const extraInstructions =
      (dynamicInstructions || "") + contextSuffix + CONFIRMATION_INSTRUCTIONS
    const finalInstructions = baseInstructions + "\n" + extraInstructions

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let stream: any
    const MAX_RETRIES = 3
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        stream = await agent.stream(chatMessages, {
          ...memoryOptions,
          instructions: finalInstructions,
          ...(Object.keys(dynamicToolset).length > 0
            ? { toolsets: { dynamic: dynamicToolset } }
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
