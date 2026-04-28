"use client"

import { useState } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { MessageSquare, Settings, Plus, ChevronDown } from "lucide-react"
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
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
  const { modelId } = useModel()
  // 初始化主题（确保 dark class 被应用）
  useTheme()

  const chatApiUrl = process.env.NEXT_PUBLIC_API_URL
    ? `${process.env.NEXT_PUBLIC_API_URL}/api/chat`
    : "/api/chat"

  const { messages, sendMessage, status, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: chatApiUrl,
      body: { modelId, agentId },
    }),
  })

  const handleSubmit = (message: PromptInputMessage) => {
    if (message.text.trim()) {
      sendMessage({ text: message.text })
      setInput("")
    }
  }

  const currentAgent = agents.find((a) => a.id === agentId) ?? agents[0]
  const currentModel = getModelById(modelId)

  return (
    <main className="flex flex-col h-dvh max-w-4xl mx-auto w-full px-2 py-3 sm:px-4 sm:py-4 md:px-6">
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
            onClick={() => setMessages([])}
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
            <ConversationEmptyState
              icon={<MessageSquare className="size-8 sm:size-12" />}
              title="欢迎使用 xinsight"
              description={`当前使用 ${currentAgent.name}，输入消息开始对话`}
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
