import { describe, it, expect, vi, beforeEach } from "vitest"
import { createTool } from "@mastra/core/tools"
import { z } from "zod"

// Mock auth
const mockRequireAuth = vi.fn()
vi.mock("@/lib/auth", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
  handleAuthError: vi.fn(),
}))

// Mock mastra — 捕获 stream 调用参数
const mockStream = vi.fn()
vi.mock("@/mastra", () => ({
  mastra: {
    getAgent: () => ({ stream: mockStream }),
  },
}))

// Mock buildDynamicTools — 返回一个假工具集
const mockBuildDynamicTools = vi.fn()
vi.mock("@/mastra/tools/datasource/build-dynamic-tools", () => ({
  buildDynamicTools: (...args: unknown[]) => mockBuildDynamicTools(...args),
}))

vi.mock("@/db/repositories/chat-repo", () => ({
  persistMessages: vi.fn(),
  autoGenerateTitle: vi.fn(),
}))
vi.mock("@/lib/schema/build-context", () => ({
  buildDatasourceContext: vi.fn().mockResolvedValue(""),
}))
vi.mock("@/db", () => ({ db: {} }))
vi.mock("@/db/repositories/agent-repository", () => ({
  SqliteAgentRepository: vi.fn().mockImplementation(() => ({
    findEnabled: vi.fn().mockResolvedValue([]),
    getAuthorizedAgentsForUser: vi
      .fn()
      .mockResolvedValue([
        { id: "production-agent" },
        { id: "chat-agent" },
        { id: "factoryDirectorAgent" },
      ]),
  })),
}))
vi.mock("@/mastra/agents/supervisor-router", () => ({
  classifyIntent: vi.fn().mockReturnValue([{ id: "chat-agent", name: "通用对话" }]),
  buildWorkerList: vi.fn().mockReturnValue([]),
  buildSupervisorInstructions: vi.fn().mockReturnValue(""),
}))
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

const fakeUser = { id: "user-1", username: "test", displayName: "测试", role: "user" }

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("chat route 动态工具集成", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockResolvedValue(fakeUser)
    mockStream.mockResolvedValue({ fake: "stream" })
  })

  it("buildDynamicTools 返回工具时，toolsets.dynamic 传入 agent.stream()", async () => {
    const fakeTool = createTool({
      id: "ds-1--ep-1",
      description: "测试工具",
      inputSchema: z.object({}),
      execute: async () => ({ success: true }),
    })
    mockBuildDynamicTools.mockResolvedValue({ "ds-1--ep-1": fakeTool })

    const { POST } = await import("@/app/api/chat/route")
    const res = await POST(
      makeRequest({
        messages: [{ role: "user", parts: [{ type: "text", text: "查工单" }] }],
        chatId: "c-1",
        agentId: "production-agent",
      }),
    )

    expect(res.status).toBe(200)
    expect(mockBuildDynamicTools).toHaveBeenCalledWith("production-agent")
    expect(mockStream).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        toolsets: { dynamic: { "ds-1--ep-1": fakeTool } },
      }),
    )
  })

  it("buildDynamicTools 返回空对象时，不传 toolsets", async () => {
    mockBuildDynamicTools.mockResolvedValue({})

    const { POST } = await import("@/app/api/chat/route")
    await POST(
      makeRequest({
        messages: [{ role: "user", parts: [{ type: "text", text: "你好" }] }],
        chatId: "c-2",
        agentId: "chat-agent",
      }),
    )

    const streamArgs = mockStream.mock.calls[0][1]
    expect(streamArgs.toolsets).toBeUndefined()
  })

  it("buildDynamicTools 抛异常时降级，不影响对话", async () => {
    mockBuildDynamicTools.mockRejectedValue(new Error("DB 连接失败"))

    const { POST } = await import("@/app/api/chat/route")
    const res = await POST(
      makeRequest({
        messages: [{ role: "user", parts: [{ type: "text", text: "你好" }] }],
        chatId: "c-3",
      }),
    )

    expect(res.status).toBe(200)
    const streamArgs = mockStream.mock.calls[0][1]
    expect(streamArgs.toolsets).toBeUndefined()
  })

  it("提示词不再引导使用旧的 datasource-query", async () => {
    const { buildDatasourceContext } = await import("@/lib/schema/build-context")
    vi.mocked(buildDatasourceContext).mockResolvedValue("ds-1: MES 数据源")
    mockBuildDynamicTools.mockResolvedValue({})

    const { POST } = await import("@/app/api/chat/route")
    await POST(
      makeRequest({
        messages: [{ role: "user", parts: [{ type: "text", text: "查数据" }] }],
        chatId: "c-4",
      }),
    )

    const streamArgs = mockStream.mock.calls[0][1]
    const instructions = streamArgs.instructions as string
    expect(instructions).not.toContain("datasource-query")
    expect(instructions).toContain("数据源ID--端点ID")
  })
})
