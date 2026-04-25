"use client"

import { useState } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { MessageSquare } from "lucide-react"
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

export default function ChatPage() {
  const [input, setInput] = useState("")
  const chatApiUrl = process.env.NEXT_PUBLIC_API_URL
    ? `${process.env.NEXT_PUBLIC_API_URL}/api/chat`
    : "/api/chat"
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: chatApiUrl }),
  })

  const handleSubmit = (message: PromptInputMessage) => {
    if (message.text.trim()) {
      sendMessage({ text: message.text })
      setInput("")
    }
  }

  return (
    <main className="flex flex-col h-dvh max-w-4xl mx-auto w-full px-2 py-3 sm:px-4 sm:py-4 md:px-6">
      <Conversation>
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              icon={<MessageSquare className="size-8 sm:size-12" />}
              title="欢迎使用 xinsight"
              description="输入消息开始对话，AI 助手将为你提供智能洞察"
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
