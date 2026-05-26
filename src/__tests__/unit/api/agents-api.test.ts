import { describe, it, expect, beforeEach, vi } from "vitest"

// 手动构造 mock mastra
const mockListAgents = vi.fn(() => ({}))
const mockMastra = { listAgents: mockListAgents }

// Mock @/mastra 模块
vi.mock("@/mastra", () => ({
  mastra: mockMastra,
}))

// Mock db (uses bun:sqlite, unavailable in Node/Vitest)
vi.mock("@/db", () => ({
  db: {},
}))

// Mock agent-repository
const mockGetAuthorizedAgentsForUser = vi.fn()
vi.mock("@/db/repositories/agent-repository", () => ({
  SqliteAgentRepository: class {
    getAuthorizedAgentsForUser(...args: any[]) {
      return mockGetAuthorizedAgentsForUser(...args)
    }
  },
}))

// Mock auth
const mockRequireAuth = vi.fn()
vi.mock("@/lib/auth", async () => {
  const { NextResponse } = await import("next/server")
  return {
    requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
    handleAuthError: (error: unknown) => {
      if (error instanceof Error && error.message === "未登录") {
        return NextResponse.json({ error: "未登录" }, { status: 401 })
      }
      return null
    },
  }
})

// 必须在 vi.mock 之后 import
const { GET } = await import("@/app/api/agents/route")

describe("GET /api/agents", () => {
  beforeEach(() => {
    mockListAgents.mockReset()
    mockRequireAuth.mockReset()
    mockGetAuthorizedAgentsForUser.mockReset()

    mockRequireAuth.mockResolvedValue({ id: "user-1", username: "test", role: "user" })
    mockGetAuthorizedAgentsForUser.mockResolvedValue([
      { id: "chatAgent", name: "聊天助手" },
      { id: "researchAgent", name: "研究助手" },
      { id: "codeAgent", name: "代码助手" },
    ])
  })

  it("未登录时返回 401", async () => {
    mockRequireAuth.mockRejectedValue(new Error("未登录"))

    const response = await GET()
    expect(response.status).toBe(401)
  })

  it("返回所有已注册且授权的 Agent 列表", async () => {
    mockListAgents.mockReturnValue({
      chatAgent: { id: "chatAgent", name: "聊天助手" },
      researchAgent: { id: "researchAgent", name: "研究助手" },
      codeAgent: { id: "codeAgent", name: "代码助手" },
    })

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual([
      { id: "chatAgent", name: "聊天助手" },
      { id: "researchAgent", name: "研究助手" },
      { id: "codeAgent", name: "代码助手" },
    ])
  })

  it("未授权的 Agent 将会被过滤掉", async () => {
    mockListAgents.mockReturnValue({
      chatAgent: { id: "chatAgent", name: "聊天助手" },
      adminAgent: { id: "adminAgent", name: "管理员助手" }, // 这个在 getAuthorizedAgentsForUser 返回中不存在
    })

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual([{ id: "chatAgent", name: "聊天助手" }])
  })

  it("只返回 id 和 name 字段", async () => {
    mockListAgents.mockReturnValue({
      chatAgent: { id: "chatAgent", name: "聊天助手", instructions: "some long text", tools: {} },
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
