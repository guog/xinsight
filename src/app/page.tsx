"use client"

import { useState, useCallback, useRef } from "react"
import dynamic from "next/dynamic"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { Square, RotateCcw, Mic } from "lucide-react"
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
import { ThinkingBlock } from "@/components/thinking-block"
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

  const chatApiUrl = process.env.NEXT_PUBLIC_API_URL
    ? `${process.env.NEXT_PUBLIC_API_URL}/api/chat`
    : "/api/chat"

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
        const apiBase = process.env.NEXT_PUBLIC_API_URL ?? ""
        const res = await fetch(`${apiBase}/api/chats/${chat.id}/messages`)
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
        const apiBase = process.env.NEXT_PUBLIC_API_URL ?? ""
        await fetch(`${apiBase}/api/chats/${id}`, { method: "DELETE" })
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
        <Conversation>
          <ConversationContent>
            {messages.length === 0 ? (
              <WelcomeEmptyState
                agentName="智能工厂助手"
                onSuggestionClick={handleSuggestionClick}
              />
            ) : (
              messages.map((message) => (
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
                            <ThinkingBlock
                              key={`${message.id}-${i}-thinking`}
                              text={rp.text}
                              state={rp.state}
                            />
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
                        case "tool-invocation": {
                          const inv = (
                            part as unknown as {
                              toolInvocation: {
                                toolName: string
                                state: "call" | "partial-call" | "result"
                                args?: Record<string, unknown>
                                result?: unknown
                              }
                            }
                          ).toolInvocation
                          return (
                            <AgentMessage
                              key={`${message.id}-${i}-tool`}
                              toolName={inv.toolName}
                              state={inv.state}
                              args={inv.args}
                              result={inv.result}
                            />
                          )
                        }
                        default:
                          return null
                      }
                    })}
                  </MessageContent>
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
              ))
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        {/* 输入区域 */}
        <div className="relative mt-2 sm:mt-4 w-full max-w-2xl mx-auto before:absolute before:inset-x-0 before:-top-6 before:h-6 before:bg-gradient-to-t before:from-background before:to-transparent before:pointer-events-none">
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
