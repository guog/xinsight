"use client"

import { useState, useCallback, useRef } from "react"
import dynamic from "next/dynamic"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { Square, RotateCcw, Mic, Brain } from "lucide-react"
import { API_BASE } from "@/lib/api"
import { formatMessageTime } from "@/lib/format-time"
import { ErrorBoundary } from "@/components/error-boundary"
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation"
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message"
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

const VoiceChatPanel = dynamic(
  () => import("@/components/voice-chat-panel").then((m) => m.VoiceChatPanel),
  {
    ssr: false,
  },
)

export default function ChatPage() {
  const isMobile = useIsMobile()

  if (isMobile) {
    return <MobileChatPage />
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

  const { createChat } = useChats()

  const chatApiUrl = API_BASE ? `${API_BASE}/api/chat` : "/api/chat"

  const { messages, sendMessage, status, setMessages, stop, regenerate } = useChat({
    transport: new DefaultChatTransport({
      api: chatApiUrl,
      body: {
        modelId,
        agentId,
        get chatId() {
          return chatIdRef.current
        },
      },
    }),
  })

  /** 新建对话 */
  const handleNewChat = useCallback(() => {
    setActiveChatId(null)
    chatIdRef.current = null
    setMessages([])
  }, [setMessages])

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
              parts: typeof m.parts === "string" ? JSON.parse(m.parts) : m.parts,
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
      <main className="flex flex-col flex-1 min-w-0 max-w-4xl mx-auto w-full px-2 py-3 sm:px-4 sm:py-4 md:px-6 pb-safe">
        {/* 首次使用引导 */}
        {!isOnboardingComplete && <OnboardingWizard onComplete={markComplete} />}
        {/* 对话区域 */}
        <ErrorBoundary>
          <Conversation>
            <ConversationContent>
              {messages.length === 0 ? (
                <WelcomeEmptyState
                  agentName="智能工厂助手"
                  onSuggestionClick={handleSuggestionClick}
                />
              ) : (
                messages.map((message) => {
                  const hasToolParts =
                    message.role === "assistant" &&
                    message.parts.some((p: { type: string }) => p.type.startsWith("tool-"))
                  return (
                    <Message from={message.role} key={message.id}>
                      <MessageContent>
                        <div className={hasToolParts ? "flex gap-3" : ""}>
                          {hasToolParts && (
                            <div className="flex-shrink-0 mt-1">
                              <div className="size-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-semibold text-slate-600 dark:text-slate-300">
                                厂
                              </div>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
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
                                            <Brain className="size-3.5 text-purple-500 dark:text-purple-400" />
                                            {isStreaming || duration === 0
                                              ? "思考中…"
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
                                  return segments.map((seg, j) =>
                                    seg.type === "chart" ? (
                                      <ChartBlock
                                        key={`${message.id}-${i}-chart-${j}`}
                                        config={seg.config}
                                      />
                                    ) : (
                                      <MessageResponse key={`${message.id}-${i}-text-${j}`}>
                                        {seg.content}
                                      </MessageResponse>
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
                          </div>
                        </div>
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
        <div className="relative mt-2 sm:mt-4 w-full max-w-3xl mx-auto before:absolute before:inset-x-0 before:-top-6 before:h-6 before:bg-gradient-to-t before:from-background before:to-transparent before:pointer-events-none">
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
              ) : (
                <PromptInputSubmit status="ready" disabled={!input.trim()} />
              )}
            </div>
          </PromptInput>
        </div>
      </main>
    </div>
  )
}
