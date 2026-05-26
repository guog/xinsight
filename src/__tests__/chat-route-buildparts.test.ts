import { describe, it, expect } from "vitest"
import { buildAssistantParts } from "@/lib/chat-utils"

describe("chat route buildAssistantParts", () => {
  it("空输入返回空数组", () => {
    const result = buildAssistantParts("", "", new Map())
    expect(result).toEqual([])
  })

  it("只有文本", () => {
    const result = buildAssistantParts("", "你好", new Map())
    expect(result).toEqual([{ type: "text", text: "你好" }])
  })

  it("只有推理文本", () => {
    const result = buildAssistantParts("思考中...", "", new Map())
    expect(result).toEqual([{ type: "reasoning", text: "思考中...", state: "done" }])
  })

  it("空白推理文本不添加", () => {
    const result = buildAssistantParts("   ", "hi", new Map())
    expect(result).toEqual([{ type: "text", text: "hi" }])
  })

  it("工具调用有输出时 state 为 output-available", () => {
    const calls = new Map([
      ["tc-1", { toolName: "search", input: { q: "test" }, output: "result" }],
    ])
    const result = buildAssistantParts("", "", calls)
    expect(result[0]).toMatchObject({
      type: "tool-search",
      toolCallId: "tc-1",
      state: "output-available",
      input: { q: "test" },
      output: "result",
    })
  })

  it("工具调用无输出时 state 为 input-available", () => {
    const calls = new Map([["tc-2", { toolName: "calc", input: { x: 1 } }]])
    const result = buildAssistantParts("", "", calls)
    expect(result[0]).toMatchObject({
      type: "tool-calc",
      state: "input-available",
    })
  })

  it("顺序为 reasoning → tools → text", () => {
    const calls = new Map([["tc-1", { toolName: "search", output: "r" }]])
    const result = buildAssistantParts("think", "answer", calls)
    expect(result[0]!.type).toBe("reasoning")
    expect(result[1]!.type).toBe("tool-search")
    expect(result[2]!.type).toBe("text")
  })

  it("多个工具调用按顺序排列", () => {
    const calls = new Map([
      ["tc-1", { toolName: "a", output: "r1" }],
      ["tc-2", { toolName: "b", input: { x: 1 } }],
    ])
    const result = buildAssistantParts("", "text", calls)
    expect(result[0]!.toolCallId).toBe("tc-1")
    expect(result[1]!.toolCallId).toBe("tc-2")
    expect(result[2]!.type).toBe("text")
  })
})
