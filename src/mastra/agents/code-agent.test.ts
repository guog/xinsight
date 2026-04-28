import { describe, it, expect } from "vitest"
import { codeAgent } from "./code-agent"

describe("codeAgent", () => {
  it("应该正确定义 agent 基本属性", () => {
    expect(codeAgent).toBeDefined()
    expect(codeAgent.name).toBe("代码助手")
    expect(codeAgent.id).toBe("code-agent")
  })
})
