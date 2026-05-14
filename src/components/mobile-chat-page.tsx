"use client"

import { useState, useCallback, useRef } from "react"
import dynamic from "next/dynamic"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { Square, RotateCcw, Mic, Menu } from "lucide-react"
import { formatMessageTime } from "@/lib/format-time"
import { API_BASE } from "@/lib/api"
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
import { useChats } from "@/hooks/use-chats"
import { useOnboarding } from "@/hooks/use-onboarding"
import { OnboardingWizard } from "@/components/onboarding-wizard"
import { WelcomeEmptyState } from "@/components/welcome-empty-state"
import { useModels } from "@/hooks/use-models"
import { parseChartBlocks } from "@/lib/chart/parse-chart-block"
import { ChartBlock } from "@/components/chart/chart-block"
import { FileUpload } from "@/components/file-upload"
import { AgentMessage } from "@/components/agent-message"
import { Reasoning, ReasoningTrigger, ReasoningContent } from "@/components/ai-elements/reasoning"
import { CodeBlockCopyProvider } from "@/components/code-block-copy"
import { useVoiceConfig } from "@/hooks/use-voice-config"
import { MobileChatDrawer } from "@/components/mobile-chat-drawer"

const VoiceChatPanel = dynamic(
  () => import("@/components/voice-chat-panel").then((m) => m.VoiceChatPanel),
  { ssr: false },
)

export function MobileChatPage() {
  const [input, setInput] = useState("")
  const agentId = "factoryDirectorAgent"
  const [showDrawer, setShowDrawer] = useState(false)
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const chatIdRef = useRef<string | null>(null)
  const { modelId } = useModel()
  const { getModelById } = useModels()
  const { isOnboardingComplete, markComplete } = useOnboarding()
  const { voiceEnabled, isVoiceMode, enterVoiceMode, exitVoiceMode } = useVoiceConfig()
  const { createChat } = useChats()

  const chatApiUrl = API_BASE ? `${API_BASE}/api/chat` : "/api/chat"
  const { messages, sendMessage, status, setMessages, stop, regenerate } = useChat({
    // 节流：每 50ms 批量合并流式更新，由 100 降至 50
    experimental_throttle: 50,
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

  const handleNewChat = useCallback(() => {
    setActiveChatId(null)
    chatIdRef.current = null
    setMessages([])
    setShowDrawer(false)
  }, [setMessages])

  const handleSelectChat = useCallback(
    async (chat: { id: string; agentId: string }) => {
      setActiveChatId(chat.id)
      chatIdRef.current = chat.id
      setShowDrawer(false)
      setIsLoadingHistory(true)
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
      } finally {
        setIsLoadingHistory(false)
      }
    },
    [setMessages],
  )

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

  const handleSuggestionClick = useCallback(
    async (text: string) => {
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
    <div className="flex flex-col h-dvh safe-top">
      <CodeBlockCopyProvider />
      {isVoiceMode && <VoiceChatPanel onClose={exitVoiceMode} />}

      {/* 顶栏 */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card/80 backdrop-blur-sm shrink-0">
        <button
          onClick={() => setShowDrawer(true)}
          className="p-2 -ml-2 rounded-lg active:bg-muted transition-colors"
        >
          <Menu className="size-5" />
        </button>
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium">🏭 智能工厂助手</span>
          <span className="text-xs text-muted-foreground">{currentModel?.name ?? modelId}</span>
        </div>
        <div className="w-9" /> {/* spacer */}
      </header>

      {/* 对话列表抽屉 */}
      <MobileChatDrawer
        open={showDrawer}
        onClose={() => setShowDrawer(false)}
        activeChatId={activeChatId}
        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
        onDeleteChat={handleDeleteChat}
      />

      {/* 引导 */}
      {!isOnboardingComplete && <OnboardingWizard onComplete={markComplete} />}

      {/* 对话区域 */}
      <Conversation className="flex-1 min-h-0">
        <ConversationContent>
          {isLoadingHistory ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              加载历史消息中…
            </div>
          ) : messages.length === 0 ? (
            <WelcomeEmptyState agentName="智能工厂助手" onSuggestionClick={handleSuggestionClick} />
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
                          <Reasoning
                            key={`${message.id}-${i}-thinking`}
                            isStreaming={rp.state === "streaming"}
                            className="rounded-xl border border-purple-200/50 bg-gradient-to-r from-purple-50/50 to-violet-50/30 dark:border-purple-800/30 dark:from-purple-950/20 dark:to-violet-950/10"
                          >
                            <ReasoningTrigger />
                            <ReasoningContent>{rp.text}</ReasoningContent>
                          </Reasoning>
                        )
                      }
                      case "text": {
                        const segments = parseChartBlocks(part.text)
                        return segments.map((seg, j) =>
                          seg.type === "chart" ? (
                            <ChartBlock key={`${message.id}-${i}-chart-${j}`} config={seg.config} />
                          ) : (
                            <MessageResponse key={`${message.id}-${i}-text-${j}`}>
                              {seg.content}
                            </MessageResponse>
                          ),
                        )
                      }
                      default: {
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
                          const toolName = tp.toolName ?? tp.type.split("-").slice(1).join("-")
                          const stateMap: Record<string, "call" | "partial-call" | "result"> = {
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
                      className="inline-flex items-center gap-1 mt-1 px-2 py-1 text-xs text-muted-foreground active:text-foreground rounded-md active:bg-muted transition-all"
                    >
                      <RotateCcw className="size-3" />
                      重新生成
                    </button>
                  )}
              </Message>
            ))
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* 输入区域 — 固定底部 */}
      <div className="shrink-0 px-3 pt-2 pb-safe border-t border-border bg-background">
        {/* 标识 */}
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs text-muted-foreground">🏭 智能工厂助手</span>
        </div>

        <PromptInput onSubmit={handleSubmit} className="relative shadow-sm rounded-xl">
          <PromptInputTextarea
            value={input}
            placeholder="输入你的问题..."
            onChange={(e) => setInput(e.currentTarget.value)}
            className="pr-20 text-base"
          />
          <div className="absolute bottom-1 right-1 flex items-center gap-1.5">
            <FileUpload disabled={status === "streaming"} />
            {voiceEnabled && (
              <button
                onClick={enterVoiceMode}
                className="flex items-center justify-center size-9 rounded-lg text-muted-foreground active:text-foreground active:bg-muted transition-colors"
              >
                <Mic className="size-5" />
              </button>
            )}
            {status === "streaming" ? (
              <button
                onClick={() => stop()}
                className="flex items-center justify-center size-9 rounded-lg bg-destructive text-destructive-foreground active:bg-destructive/90 transition-colors animate-pulse"
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
    </div>
  )
}
