"use client"

import { useState, useCallback, useRef } from "react"
import dynamic from "next/dynamic"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { ChevronDown, Square, RotateCcw, Mic, Menu } from "lucide-react"
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
import { ToolInvocation } from "@/components/tool-invocation"
import { CodeBlockCopyProvider } from "@/components/code-block-copy"
import { useVoiceConfig } from "@/hooks/use-voice-config"
import { MobileChatDrawer } from "@/components/mobile-chat-drawer"

const VoiceChatPanel = dynamic(
  () => import("@/components/voice-chat-panel").then((m) => m.VoiceChatPanel),
  { ssr: false },
)

const agents = [
  { id: "autoAgent", name: "自动", description: "智能选择最佳模式" },
  { id: "chatAgent", name: "聊天助手", description: "通用对话" },
  { id: "researchAgent", name: "研究助手", description: "深度分析" },
  { id: "codeAgent", name: "代码助手", description: "编程辅助" },
]

export function MobileChatPage() {
  const [input, setInput] = useState("")
  const [agentId, setAgentId] = useState("autoAgent")
  const [showAgentMenu, setShowAgentMenu] = useState(false)
  const [showDrawer, setShowDrawer] = useState(false)
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const chatIdRef = useRef<string | null>(null)
  const { modelId } = useModel()
  const { getModelById } = useModels()
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
      setAgentId(chat.agentId)
      setShowDrawer(false)
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

  const currentAgent = agents.find((a) => a.id === agentId) ?? agents[0]
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
          <span className="text-sm font-medium">{currentAgent.name}</span>
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
          {messages.length === 0 ? (
            <WelcomeEmptyState
              agentName={currentAgent.name}
              onSuggestionClick={handleSuggestionClick}
            />
          ) : (
            messages.map((message) => (
              <Message from={message.role} key={message.id}>
                <MessageContent>
                  {message.parts.map((part, i) => {
                    switch (part.type) {
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
                          <ToolInvocation
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
        {/* Agent 切换 */}
        <div className="flex items-center gap-2 mb-1.5">
          <div className="relative">
            <button
              onClick={() => setShowAgentMenu(!showAgentMenu)}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-border bg-muted/50 active:bg-muted transition-colors"
            >
              {currentAgent.name}
              <ChevronDown className="size-3" />
            </button>
            {showAgentMenu && (
              <div className="absolute bottom-full left-0 mb-1 w-48 bg-popover border border-border rounded-xl shadow-xl z-10 animate-in fade-in slide-in-from-bottom-2 duration-200">
                {agents.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => {
                      setAgentId(agent.id)
                      setShowAgentMenu(false)
                    }}
                    className={`w-full text-left px-3 py-2.5 text-sm active:bg-muted transition-colors first:rounded-t-xl last:rounded-b-xl ${
                      agentId === agent.id ? "bg-primary/10 text-primary" : ""
                    }`}
                  >
                    <div className="font-medium">{agent.name}</div>
                    <div className="text-xs text-muted-foreground">{agent.description}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
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
            ) : (
              <PromptInputSubmit status="ready" disabled={!input.trim()} />
            )}
          </div>
        </PromptInput>
      </div>
    </div>
  )
}
