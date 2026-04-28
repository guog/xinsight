import { describe, it, expect } from "vitest"
import { researchAgent } from "./research-agent"

describe("researchAgent", () => {
  it("应该正确定义 agent 基本属性", () => {
    expect(researchAgent).toBeDefined()
    expect(researchAgent.name).toBe("研究助手")
    expect(researchAgent.id).toBe("research-agent")
  })
})
