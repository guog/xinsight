import { createUIMessageStream, createUIMessageStreamResponse } from "ai"
import type { UIMessage } from "ai"
import { toAISdkStream } from "@mastra/ai-sdk"

import { mastra } from "@/mastra"

// 允许流式响应最长 60 秒
export const maxDuration = 60

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json()

  const agent = mastra.getAgent("chatAgent")
  const stream = await agent.stream(messages)

  const uiMessageStream = createUIMessageStream({
    originalMessages: messages,
    execute: async ({ writer }) => {
      const reader = toAISdkStream(stream, { from: "agent", version: "v6" }).getReader()
      try {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          await writer.write(value)
        }
      } finally {
        reader.releaseLock()
      }
    },
  })

  return createUIMessageStreamResponse({
    stream: uiMessageStream,
  })
}
