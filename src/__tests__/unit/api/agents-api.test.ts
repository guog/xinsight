import { describe, it, expect, beforeEach, vi } from "vitest"

// 手动构造 mock mastra
const mockListAgents = vi.fn(() => ({}))
const mockMastra = { listAgents: mockListAgents }

// Mock @/mastra 模块
vi.mock("@/mastra", () => ({
  mastra: mockMastra,
}))

// 必须在 vi.mock 之后 import
const { GET } = await import("@/app/api/agents/route")

describe("GET /api/agents", () => {
  beforeEach(() => {
    mockListAgents.mockReset()
  })

  it("返回所有已注册的 Agent 列表", async () => {
    mockListAgents.mockReturnValue({
      chatAgent: { id: "chat-agent", name: "聊天助手" },
      researchAgent: { id: "research-agent", name: "研究助手" },
      codeAgent: { id: "code-agent", name: "代码助手" },
    })

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual([
      { id: "chat-agent", name: "聊天助手" },
      { id: "research-agent", name: "研究助手" },
      { id: "code-agent", name: "代码助手" },
    ])
  })

  it("只返回 id 和 name 字段", async () => {
    mockListAgents.mockReturnValue({
      chatAgent: { id: "chat-agent", name: "聊天助手", instructions: "some long text", tools: {} },
    })

    const response = await GET()
    const data = await response.json()

    expect(data).toHaveLength(1)
    expect(Object.keys(data[0])).toEqual(["id", "name"])
  })

  it("mastra 异常时返回 500", async () => {
    mockListAgents.mockImplementation(() => {
      throw new Error("mastra error")
    })

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe("获取 Agent 列表失败")
  })
})
