import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock auth module
const mockRequireAuth = vi.fn()
const mockHandleAuthError = vi.fn()
vi.mock("@/lib/auth", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
  handleAuthError: (...args: unknown[]) => mockHandleAuthError(...args),
}))

// Mock mastra
const mockStream = vi.fn()
vi.mock("@/mastra", () => ({
  mastra: {
    getAgent: () => ({
      stream: mockStream,
    }),
    listAgents: () => ({
      factoryDirectorAgent: { id: "factoryDirectorAgent", name: "厂长" },
    }),
  },
}))

// Mock db repos
vi.mock("@/db/repositories/chat-repo", () => ({
  persistMessages: vi.fn(),
  autoGenerateTitle: vi.fn(),
}))

// Mock build-context
vi.mock("@/lib/schema/build-context", () => ({
  buildDatasourceContext: vi.fn().mockResolvedValue(""),
}))

// Mock db (uses bun:sqlite, unavailable in Node/Vitest)
vi.mock("@/db", () => ({
  db: {},
}))

// Mock agent-repository
const mockGetAuthorizedAgentsForUser = vi.fn()
vi.mock("@/db/repositories/agent-repository", () => ({
  SqliteAgentRepository: vi.fn().mockImplementation(() => ({
    findEnabled: vi.fn().mockResolvedValue([]),
    findById: vi.fn().mockResolvedValue({ id: "factory-director", name: "厂长", isBuiltin: true }),
    getAuthorizedAgentsForUser: (...args: unknown[]) => mockGetAuthorizedAgentsForUser(...args),
  })),
}))

// Mock supervisor-router
vi.mock("@/mastra/agents/supervisor-router", () => ({
  classifyIntent: vi.fn().mockReturnValue([{ id: "chat-agent", name: "通用对话" }]),
  buildWorkerList: vi.fn().mockReturnValue([]),
  buildSupervisorInstructions: vi.fn().mockReturnValue(""),
}))

// Mock ai SDK
vi.mock("ai", () => ({
  createUIMessageStream: vi.fn(() => new ReadableStream()),
  createUIMessageStreamResponse: vi.fn(() => new Response("ok", { status: 200 })),
}))

vi.mock("@mastra/ai-sdk", () => ({
  toAISdkStream: vi.fn(() => ({
    getReader: () => ({
      read: vi.fn().mockResolvedValue({ done: true }),
      releaseLock: vi.fn(),
    }),
  })),
}))

describe("/api/chat POST 认证与鉴权", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 默认让用户有权访问 factoryDirectorAgent
    mockGetAuthorizedAgentsForUser.mockResolvedValue([{ id: "factoryDirectorAgent", name: "厂长" }])
  })

  it("未登录时返回 401", async () => {
    const authError = new Error("未登录")
    mockRequireAuth.mockRejectedValue(authError)
    mockHandleAuthError.mockReturnValue(Response.json({ error: "未登录" }, { status: 401 }))

    const { POST } = await import("@/app/api/chat/route")
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [] }),
    })

    const res = await POST(req)
    expect(res.status).toBe(401)
    expect(mockRequireAuth).toHaveBeenCalled()
  })

  it("无权访问所请求的 Agent 时返回 403", async () => {
    const fakeUser = {
      id: "user-abc-123",
      username: "testuser",
      displayName: "测试用户",
      role: "user",
    }
    mockRequireAuth.mockResolvedValue(fakeUser)
    // 模拟 getAuthorizedAgentsForUser 返回不包含任何 Agent
    mockGetAuthorizedAgentsForUser.mockResolvedValue([])

    const { POST } = await import("@/app/api/chat/route")
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "你好" }],
        agentId: "factoryDirectorAgent",
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe("无权访问此 Agent")
  })

  it("已登录且有权限时正常处理，resourceId 使用真实用户 ID", async () => {
    const fakeUser = {
      id: "user-abc-123",
      username: "testuser",
      displayName: "测试用户",
      role: "user",
    }
    mockRequireAuth.mockResolvedValue(fakeUser)
    mockStream.mockResolvedValue({ fake: "stream" })

    const { POST } = await import("@/app/api/chat/route")
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "你好" }],
        chatId: "chat-001",
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)

    // 验证 stream 被调用时 resourceId 是用户真实 ID
    expect(mockStream).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        resourceId: "user-abc-123",
        threadId: "chat-001",
      }),
    )
  })
})
