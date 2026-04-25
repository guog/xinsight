import { describe, it, expect } from "vitest"
import { chatAgent } from "./chat-agent"

describe("chatAgent", () => {
  it("应该正确定义 agent 基本属性", () => {
    expect(chatAgent).toBeDefined()
    expect(chatAgent.name).toBe("聊天助手")
    expect(chatAgent.id).toBe("chat-agent")
  })

  it("应该使用 deepseek 模型", () => {
    expect(chatAgent.model).toBe("deepseek/deepseek-chat")
  })
})
