"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { Settings, Plus, ChevronDown } from "lucide-react"
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
import { useChats, type Chat } from "@/hooks/use-chats"
import { useOnboarding } from "@/hooks/use-onboarding"
import { OnboardingWizard } from "@/components/onboarding-wizard"
import { WelcomeEmptyState } from "@/components/welcome-empty-state"
import { getModelById } from "@/lib/models"
import Link from "next/link"

/** Agent 定义 */
const agents = [
  { id: "chatAgent", name: "聊天助手", description: "通用对话" },
  { id: "researchAgent", name: "研究助手", description: "深度分析" },
  { id: "codeAgent", name: "代码助手", description: "编程辅助" },
]

export default function ChatPage() {
  const [input, setInput] = useState("")
  const [agentId, setAgentId] = useState("chatAgent")
  const [showAgentMenu, setShowAgentMenu] = useState(false)
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const chatIdRef = useRef<string | null>(null)
  const { modelId } = useModel()
  useTheme()
  const { isOnboardingComplete, markComplete } = useOnboarding()

  const { chats, createChat } = useChats()

  const chatApiUrl = process.env.NEXT_PUBLIC_API_URL
    ? `${process.env.NEXT_PUBLIC_API_URL}/api/chat`
    : "/api/chat"

  const { messages, sendMessage, status, setMessages } = useChat({
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

  /** 切换到已有对话 */
  const switchChat = useCallback(
    async (chat: Chat) => {
      setActiveChatId(chat.id)
      chatIdRef.current = chat.id
      setAgentId(chat.agentId)
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

  /** 新建对话 */
  const handleNewChat = useCallback(async () => {
    try {
      const chat = await createChat({ agentId })
      setActiveChatId(chat.id)
      chatIdRef.current = chat.id
      setMessages([])
    } catch (e) {
      console.error("创建对话失败:", e)
    }
  }, [agentId, createChat, setMessages])

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

  /** 点击建议直接发送 */
  const handleSuggestionClick = useCallback(
    (text: string) => {
      sendMessage({ text })
    },
    [sendMessage],
  )

  const currentAgent = agents.find((a) => a.id === agentId) ?? agents[0]
  const currentModel = getModelById(modelId)

  return (
    <main className="flex flex-col h-dvh max-w-4xl mx-auto w-full px-2 py-3 sm:px-4 sm:py-4 md:px-6">
      {/* 首次使用引导 */}
      {!isOnboardingComplete && <OnboardingWizard onComplete={markComplete} />}
      {/* 顶部工具栏 */}
      <header className="flex items-center justify-between mb-2 sm:mb-3">
        <div className="flex items-center gap-2">
          {/* Agent 切换 */}
          <div className="relative">
            <button
              onClick={() => setShowAgentMenu(!showAgentMenu)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-muted transition-colors"
            >
              {currentAgent.name}
              <ChevronDown className="size-3.5" />
            </button>
            {showAgentMenu && (
              <div className="absolute top-full left-0 mt-1 w-48 bg-popover border border-border rounded-lg shadow-lg z-10">
                {agents.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => {
                      setAgentId(agent.id)
                      setShowAgentMenu(false)
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors first:rounded-t-lg last:rounded-b-lg ${
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

          {/* 模型显示 */}
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {currentModel?.name ?? modelId}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleNewChat}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            title="新对话"
          >
            <Plus className="size-4" />
          </button>
          <Link
            href="/settings"
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            title="设置"
          >
            <Settings className="size-4" />
          </Link>
        </div>
      </header>

      {/* 对话区域 */}
      <Conversation>
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
                      case "text":
                        return (
                          <MessageResponse key={`${message.id}-${i}`}>{part.text}</MessageResponse>
                        )
                      default:
                        return null
                    }
                  })}
                </MessageContent>
              </Message>
            ))
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* 输入区域 */}
      <PromptInput
        onSubmit={handleSubmit}
        className="mt-2 sm:mt-4 w-full max-w-2xl mx-auto relative"
      >
        <PromptInputTextarea
          value={input}
          placeholder="输入你的问题..."
          onChange={(e) => setInput(e.currentTarget.value)}
          className="pr-12"
        />
        <PromptInputSubmit
          status={status === "streaming" ? "streaming" : "ready"}
          disabled={!input.trim()}
          className="absolute bottom-1 right-1"
        />
      </PromptInput>
    </main>
  )
}
