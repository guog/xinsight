import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock mastra before importing route
vi.mock("@/mastra", () => ({
  mastra: {
    listAgents: vi.fn(),
  },
}))

import { GET } from "@/app/api/agents/route"
import { mastra } from "@/mastra"

describe("GET /api/agents", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("返回所有已注册的 Agent 列表", async () => {
    vi.mocked(mastra.listAgents).mockReturnValue({
      chatAgent: { id: "chat-agent", name: "聊天助手" },
      researchAgent: { id: "research-agent", name: "研究助手" },
      codeAgent: { id: "code-agent", name: "代码助手" },
    } as ReturnType<typeof mastra.listAgents>)

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
    vi.mocked(mastra.listAgents).mockReturnValue({
      chatAgent: { id: "chat-agent", name: "聊天助手", instructions: "some long text", tools: {} },
    } as ReturnType<typeof mastra.listAgents>)

    const response = await GET()
    const data = await response.json()

    expect(data).toHaveLength(1)
    expect(Object.keys(data[0])).toEqual(["id", "name"])
  })

  it("mastra 异常时返回 500", async () => {
    vi.mocked(mastra.listAgents).mockImplementation(() => {
      throw new Error("mastra error")
    })

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe("获取 Agent 列表失败")
  })
})
