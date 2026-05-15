"use client"

import { useState, useCallback, useRef, useEffect, useMemo } from "react"
import dynamic from "next/dynamic"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { Square, RotateCcw, Mic, Copy, Download, Check } from "lucide-react"
import { API_BASE } from "@/lib/api"
import { formatMessageTime } from "@/lib/format-time"
import { ErrorBoundary } from "@/components/error-boundary"
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation"
import {
  Message,
  MessageContent,
  MessageResponse,
  MessageActions,
  MessageAction,
} from "@/components/ai-elements/message"
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input"
import { useModel } from "@/hooks/use-model"
import { useTheme } from "@/hooks/use-theme"
import { useChats } from "@/hooks/use-chats"
import { useOnboarding } from "@/hooks/use-onboarding"
import { OnboardingWizard } from "@/components/onboarding-wizard"
import { WelcomeEmptyState } from "@/components/welcome-empty-state"
import { useModels } from "@/hooks/use-models"
import { parseChartBlocks } from "@/lib/chart/parse-chart-block"
import { ChartBlock } from "@/components/chart/chart-block"
import { FileUpload } from "@/components/file-upload"
import { Sidebar, type ChatItem } from "@/components/sidebar"
import { AgentMessage } from "@/components/agent-message"
import { Reasoning, ReasoningTrigger, ReasoningContent } from "@/components/ai-elements/reasoning"
import { CodeBlockCopyProvider } from "@/components/code-block-copy"
import { useVoiceConfig } from "@/hooks/use-voice-config"
import { useIsMobile } from "@/hooks/use-device"
import { MobileChatPage } from "@/components/mobile-chat-page"
import { AgentProgressContext, createAgentProgressStore } from "@/hooks/use-agent-progress"

const VoiceChatPanel = dynamic(
  () => import("@/components/voice-chat-panel").then((m) => m.VoiceChatPanel),
  {
    ssr: false,
  },
)

export default function ChatPage() {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <ErrorBoundary>
        <MobileChatPage />
      </ErrorBoundary>
    )
  }

  return <DesktopChatPage />
}

function DesktopChatPage() {
  const [input, setInput] = useState("")
  const agentId = "factoryDirectorAgent"
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const chatIdRef = useRef<string | null>(null)
  const { modelId } = useModel()
  const { getModelById } = useModels()
  useTheme()
  const { isOnboardingComplete, markComplete } = useOnboarding()
  const { voiceEnabled, isVoiceMode, enterVoiceMode, exitVoiceMode } = useVoiceConfig()

  // 子 Agent 流式进度 store（稳定引用，不随 render 重建）
  const agentProgressStore = useMemo(() => createAgentProgressStore(), [])

  const { createChat, refresh: refreshChats } = useChats()

  const chatApiUrl = API_BASE ? `${API_BASE}/api/chat` : "/api/chat"

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: chatApiUrl,
        body: {
          modelId,
          agentId,
          get chatId() {
            return chatIdRef.current
          },
        },
      }),
    [chatApiUrl, modelId, agentId],
  )

  const { messages, sendMessage, status, setMessages, stop, regenerate } = useChat({
    // 节流：每 50ms 批量合并流式更新，避免多 Agent 并行时每 token 触发 re-render，由 100 降低至 50 提升流畅度同时兼顾性能
    experimental_throttle: 50,
    transport,
    // 接收子 Agent 流式进度（transient data-agent-progress 事件）
    onData: (dataPart) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const part = dataPart as any
      if (part.type === "data-agent-progress" && part.data?.textDelta) {
        // 存储多个 key 以便前端匹配（runId 和 toolCallId 可能不同）
        const { runId, toolCallId, textDelta } = part.data
        agentProgressStore.append(runId, textDelta)
        if (toolCallId && toolCallId !== runId) {
          agentProgressStore.append(toolCallId, textDelta)
        }
      }
    },
  })

  /** 流式结束后刷新侧边栏（更新自动生成的标题等） */
  const prevStatusRef = useRef(status)
  useEffect(() => {
    if (prevStatusRef.current === "streaming" && status === "ready") {
      // 多次延迟刷新以等待服务端 autoGenerateTitle 完成（LLM 调用约 2-5 秒）
      refreshChats()
      setTimeout(() => refreshChats(), 3000)
      setTimeout(() => refreshChats(), 6000)
    }
    prevStatusRef.current = status
  }, [status, refreshChats])

  /** 新建对话 */
  const handleNewChat = useCallback(() => {
    setActiveChatId(null)
    chatIdRef.current = null
    setMessages([])
    agentProgressStore.clear()
  }, [setMessages, agentProgressStore])

  /** 选择已有对话 */
  const handleSelectChat = useCallback(
    async (chat: ChatItem) => {
      setActiveChatId(chat.id)
      chatIdRef.current = chat.id
      try {
        const res = await fetch(`${API_BASE}/api/chats/${chat.id}/messages`)
        if (res.ok) {
          const msgs = await res.json()
          const uiMessages = msgs.map(
            (m: { id: string; role: string; parts: string; createdAt: string }) => ({
              id: m.id,
              role: m.role,
              parts: (() => {
                try {
                  return typeof m.parts === "string" ? JSON.parse(m.parts) : m.parts
                } catch {
                  return [{ type: "text", text: typeof m.parts === "string" ? m.parts : "" }]
                }
              })(),
              createdAt: new Date(m.createdAt),
            }),
          )
          setMessages(uiMessages)
        }
      } catch (e) {
        console.error("加载历史消息失败:", e)
      }
    },
    [setMessages],
  )

  /** 删除对话 */
  const handleDeleteChat = useCallback(
    async (id: string) => {
      try {
        await fetch(`${API_BASE}/api/chats/${id}`, { method: "DELETE" })
        if (activeChatId === id) {
          setActiveChatId(null)
          chatIdRef.current = null
          setMessages([])
        }
      } catch (e) {
        console.error("删除对话失败:", e)
      }
    },
    [activeChatId, setMessages],
  )

  const handleSubmit = useCallback(
    async (message: PromptInputMessage) => {
      if (!message.text.trim()) return

      // 如果没有活动会话，先创建
      let chatId = activeChatId
      if (!chatId) {
        try {
          const chat = await createChat({ agentId })
          chatId = chat.id
          setActiveChatId(chatId)
          chatIdRef.current = chatId
        } catch (e) {
          console.error("创建对话失败:", e)
          return
        }
      }

      sendMessage({ text: message.text })
      setInput("")
    },
    [activeChatId, agentId, createChat, sendMessage],
  )

  /** 点击建议直接发送 */
  const handleSuggestionClick = useCallback(
    async (text: string) => {
      // 如果没有活动会话，先创建
      if (!activeChatId) {
        try {
          const chat = await createChat({ agentId })
          setActiveChatId(chat.id)
          chatIdRef.current = chat.id
        } catch (e) {
          console.error("创建对话失败:", e)
          return
        }
      }
      sendMessage({ text })
    },
    [activeChatId, agentId, createChat, sendMessage],
  )

  const currentModel = getModelById(modelId)

  return (
    <AgentProgressContext value={agentProgressStore}>
      <div className="flex h-dvh">
        <CodeBlockCopyProvider />
        {/* 语音模式覆盖层 */}
        {isVoiceMode && <VoiceChatPanel onClose={exitVoiceMode} />}
        {/* 侧边栏 */}
        <Sidebar
          activeChatId={activeChatId}
          onNewChat={handleNewChat}
          onSelectChat={handleSelectChat}
          onDeleteChat={handleDeleteChat}
        />

        {/* 主内容区 */}
        <main className="flex flex-col flex-1 min-w-0 w-full py-3 sm:py-4 pb-safe">
          {/* 首次使用引导 */}
          {!isOnboardingComplete && <OnboardingWizard onComplete={markComplete} />}
          {/* 对话区域 */}
          <ErrorBoundary>
            <Conversation>
              <ConversationContent className="max-w-4xl mx-auto w-full px-2 sm:px-4 md:px-6">
                {messages.length === 0 ? (
                  <WelcomeEmptyState
                    agentName="智能工厂助手"
                    onSuggestionClick={handleSuggestionClick}
                  />
                ) : (
                  messages.map((message) => {
                    return (
                      <Message from={message.role} key={message.id}>
                        <MessageContent>
                          {message.parts.map((part, i) => {
                            switch (part.type) {
                              case "reasoning": {
                                const rp = part as {
                                  type: "reasoning"
                                  text: string
                                  state?: "streaming" | "done"
                                }
                                return (
                                  <Reasoning
                                    key={`${message.id}-${i}-thinking`}
                                    isStreaming={rp.state === "streaming"}
                                    defaultOpen={rp.state === "streaming"}
                                    className="rounded-xl border border-purple-200/50 bg-gradient-to-r from-purple-50/50 to-violet-50/30 dark:border-purple-800/30 dark:from-purple-950/20 dark:to-violet-950/10"
                                  >
                                    <ReasoningTrigger
                                      getThinkingMessage={(isStreaming, duration) => (
                                        <span className="inline-flex items-center gap-1.5">
                                          {isStreaming || duration === 0
                                            ? "思考中…"
                                            : duration === undefined
                                              ? "已深度思考"
                                              : `已深度思考 ${duration} 秒`}
                                        </span>
                                      )}
                                    />
                                    <ReasoningContent>{rp.text}</ReasoningContent>
                                  </Reasoning>
                                )
                              }
                              case "text": {
                                const segments = parseChartBlocks(part.text)

                                // Find full text content for copy action
                                const fullText = segments
                                  .filter((s) => s.type === "text")
                                  .map((s) => (s as { content: string }).content)
                                  .join("\n")
                                  .trim()
                                return segments.map((seg, j) =>
                                  seg.type === "chart" ? (
                                    <ChartBlock
                                      key={`${message.id}-${i}-chart-${j}`}
                                      config={seg.config}
                                    />
                                  ) : (
                                    <div
                                      key={`${message.id}-${i}-text-${j}`}
                                      className="group/text relative"
                                    >
                                      <MessageResponse>{seg.content}</MessageResponse>
                                      {status !== "streaming" &&
                                        message.role === "assistant" &&
                                        j === segments.length - 1 && (
                                          <div className="mt-2 opacity-0 group-hover/text:opacity-100 transition-opacity">
                                            <MessageActions>
                                              <MessageAction
                                                tooltip="复制为格式化报告"
                                                onClick={() => {
                                                  navigator.clipboard.writeText(fullText)
                                                }}
                                              >
                                                <Copy className="size-4" />
                                              </MessageAction>
                                            </MessageActions>
                                          </div>
                                        )}
                                    </div>
                                  ),
                                )
                              }
                              default: {
                                // AI SDK v6: tool parts have type="tool-{toolName}"
                                // with fields: toolCallId, toolName, state, input, output
                                if (part.type.startsWith("tool-")) {
                                  const tp = part as unknown as {
                                    type: string
                                    toolCallId: string
                                    toolName?: string
                                    state:
                                      | "input-streaming"
                                      | "input-available"
                                      | "output-available"
                                      | "output-error"
                                    input?: unknown
                                    output?: unknown
                                  }
                                  // Extract toolName from type: "tool-agent-productionAgent" → "agent-productionAgent"
                                  const toolName =
                                    tp.toolName ?? tp.type.split("-").slice(1).join("-")
                                  // Map v6 states to AgentMessage states
                                  const stateMap: Record<
                                    string,
                                    "call" | "partial-call" | "result"
                                  > = {
                                    "input-streaming": "partial-call",
                                    "input-available": "call",
                                    "output-available": "result",
                                    "output-error": "result",
                                  }
                                  return (
                                    <AgentMessage
                                      key={`${message.id}-${i}-tool`}
                                      toolCallId={tp.toolCallId}
                                      toolName={toolName}
                                      state={stateMap[tp.state] ?? "call"}
                                      args={tp.input as Record<string, unknown>}
                                      result={tp.output}
                                    />
                                  )
                                }
                                return null
                              }
                            }
                          })}
                        </MessageContent>
                        {(message as { createdAt?: Date }).createdAt && (
                          <time className="block text-[10px] text-muted-foreground/60 mt-1 px-1 select-none">
                            {formatMessageTime((message as { createdAt?: Date }).createdAt!)}
                          </time>
                        )}
                        {message.role === "assistant" &&
                          message === messages[messages.length - 1] &&
                          status !== "streaming" && (
                            <button
                              onClick={() => regenerate()}
                              className="group inline-flex items-center gap-1 mt-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-all duration-200"
                            >
                              <RotateCcw className="size-3 transition-transform duration-300 group-hover:-rotate-180" />
                              重新生成
                            </button>
                          )}
                      </Message>
                    )
                  })
                )}
              </ConversationContent>
              <ConversationScrollButton />
            </Conversation>
          </ErrorBoundary>

          {/* 输入区域 */}
          <div className="relative mt-2 sm:mt-4 w-full max-w-4xl mx-auto px-2 sm:px-4 md:px-6 before:absolute before:inset-x-0 before:-top-6 before:h-6 before:bg-gradient-to-t before:from-background before:to-transparent before:pointer-events-none">
            {/* 工具栏 */}
            <div className="flex items-center gap-2 mb-1.5 px-1">
              <span className="text-xs font-medium text-muted-foreground">🏭 智能工厂助手</span>
              <span className="text-xs text-muted-foreground">·</span>
              {/* Model label */}
              <span className="text-xs text-muted-foreground">{currentModel?.name ?? modelId}</span>
            </div>

            {/* Input */}
            <PromptInput
              onSubmit={handleSubmit}
              className="relative shadow-sm hover:shadow-md focus-within:shadow-md focus-within:ring-1 focus-within:ring-ring/30 transition-all duration-200 rounded-xl"
            >
              <PromptInputTextarea
                value={input}
                placeholder="输入你的问题..."
                onChange={(e) => setInput(e.currentTarget.value)}
                className="pr-20"
              />
              <div className="absolute bottom-1 right-1 flex items-center gap-1.5">
                <FileUpload disabled={status === "streaming"} />
                {voiceEnabled && (
                  <button
                    onClick={enterVoiceMode}
                    title="语音模式"
                    className="flex items-center justify-center size-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <Mic className="size-4" />
                  </button>
                )}
                {status === "streaming" ? (
                  <button
                    onClick={() => stop()}
                    className="flex items-center justify-center size-8 rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors animate-pulse shadow-sm shadow-destructive/30"
                  >
                    <Square className="size-4" />
                  </button>
                ) : status === "submitted" ? (
                  <PromptInputSubmit status="submitted" disabled={false} />
                ) : (
                  <PromptInputSubmit status="ready" disabled={!input.trim()} />
                )}
              </div>
            </PromptInput>
          </div>
        </main>
      </div>
    </AgentProgressContext>
  )
}
