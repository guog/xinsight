"use client"

import { useState, useCallback, useRef } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { ChevronDown, Square, RotateCcw } from "lucide-react"
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
import { getModelById } from "@/lib/models"
import { parseChartBlocks } from "@/lib/chart/parse-chart-block"
import { ChartBlock } from "@/components/chart/chart-block"
import { FileUpload } from "@/components/file-upload"
import { Sidebar, type ChatItem } from "@/components/sidebar"
import { ToolInvocation } from "@/components/tool-invocation"
import { CodeBlockCopyProvider } from "@/components/code-block-copy"

/** Agent 定义 */
const agents = [
  { id: "autoAgent", name: "自动", description: "智能选择最佳模式" },
  { id: "chatAgent", name: "聊天助手", description: "通用对话" },
  { id: "researchAgent", name: "研究助手", description: "深度分析" },
  { id: "codeAgent", name: "代码助手", description: "编程辅助" },
]

export default function ChatPage() {
  const [input, setInput] = useState("")
  const [agentId, setAgentId] = useState("autoAgent")
  const [showAgentMenu, setShowAgentMenu] = useState(false)
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const chatIdRef = useRef<string | null>(null)
  const { modelId } = useModel()
  useTheme()
  const { isOnboardingComplete, markComplete } = useOnboarding()

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

  const currentAgent = agents.find((a) => a.id === agentId) ?? agents[0]
  const currentModel = getModelById(modelId)

  return (
    <div className="flex h-dvh">
      <CodeBlockCopyProvider />
      {/* 侧边栏 */}
      <Sidebar
        activeChatId={activeChatId}
        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
        onDeleteChat={handleDeleteChat}
      />

      {/* 主内容区 */}
      <main className="flex flex-col flex-1 min-w-0 max-w-4xl mx-auto w-full px-2 py-3 sm:px-4 sm:py-4 md:px-6">
        {/* 首次使用引导 */}
        {!isOnboardingComplete && <OnboardingWizard onComplete={markComplete} />}
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
                        className="flex items-center gap-1 mt-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors"
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

        {/* 输入区域 */}
        <div className="mt-2 sm:mt-4 w-full max-w-2xl mx-auto">
          {/* 工具栏 */}
          <div className="flex items-center gap-2 mb-1.5 px-1">
            {/* Agent 选择器 */}
            <div className="relative">
              <button
                onClick={() => setShowAgentMenu(!showAgentMenu)}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-border hover:bg-muted transition-colors"
              >
                {currentAgent.name}
                <ChevronDown className="size-3" />
              </button>
              {showAgentMenu && (
                <div className="absolute bottom-full left-0 mb-1 w-44 bg-popover border border-border rounded-lg shadow-lg z-10">
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
            {/* Model label */}
            <span className="text-xs text-muted-foreground">{currentModel?.name ?? modelId}</span>
          </div>

          {/* Input */}
          <PromptInput onSubmit={handleSubmit} className="relative">
            <PromptInputTextarea
              value={input}
              placeholder="输入你的问题..."
              onChange={(e) => setInput(e.currentTarget.value)}
              className="pr-20"
            />
            <div className="absolute bottom-1 right-1 flex items-center gap-1">
              <FileUpload disabled={status === "streaming"} />
              {status === "streaming" ? (
                <button
                  onClick={() => stop()}
                  className="flex items-center justify-center size-8 rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
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
