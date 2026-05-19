import { describe, it, expect, vi, beforeEach } from "vitest"

const mockRequireAdmin = vi.fn()
vi.mock("@/lib/auth", () => ({
  requireAdmin: () => mockRequireAdmin(),
  handleAuthError: (error: unknown) => {
    if (error instanceof Error && error.message === "需要管理员权限") {
      return Response.json({ error: "需要管理员权限" }, { status: 403 })
    }
    return Response.json({ error: "未登录" }, { status: 401 })
  },
}))

const mockFindAll = vi.fn()
const mockCreate = vi.fn()
const mockFindById = vi.fn()
const mockUpdate = vi.fn()
const mockDelete = vi.fn()

vi.mock("@/db/repositories/agent-repository", () => ({
  SqliteAgentRepository: class {
    findAll = mockFindAll
    create = mockCreate
    findById = mockFindById
    update = mockUpdate
    delete = mockDelete
  },
}))

vi.mock("@/db", () => ({ db: {} }))

describe("/api/admin/agents", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  describe("GET /api/admin/agents", () => {
    it("非管理员返回 403", async () => {
      mockRequireAdmin.mockRejectedValue(new Error("需要管理员权限"))
      const { GET } = await import("@/app/api/admin/agents/route")
      const res = await GET()
      expect(res.status).toBe(403)
    })

    it("返回全部 Agent 列表", async () => {
      mockRequireAdmin.mockResolvedValue(undefined)
      mockFindAll.mockResolvedValue([
        { id: "chat-agent", name: "聊天助手", isBuiltin: true, enabled: true },
        { id: "custom-1", name: "自定义", isBuiltin: false, enabled: true },
      ])
      const { GET } = await import("@/app/api/admin/agents/route")
      const res = await GET()
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.agents).toHaveLength(2)
    })
  })

  describe("POST /api/admin/agents", () => {
    it("创建自定义 Agent", async () => {
      mockRequireAdmin.mockResolvedValue(undefined)
      const input = { id: "my-agent", name: "我的助手", systemPrompt: "你是助手" }
      mockCreate.mockResolvedValue({ ...input, isBuiltin: false, enabled: true })

      const { POST } = await import("@/app/api/admin/agents/route")
      const req = new Request("http://localhost/api/admin/agents", {
        method: "POST",
        body: JSON.stringify(input),
        headers: { "Content-Type": "application/json" },
      })
      const res = await POST(req)
      expect(res.status).toBe(201)
      const data = await res.json()
      expect(data.id).toBe("my-agent")
    })

    it("缺少必填字段返回 400", async () => {
      mockRequireAdmin.mockResolvedValue(undefined)
      const { POST } = await import("@/app/api/admin/agents/route")
      const req = new Request("http://localhost/api/admin/agents", {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      })
      const res = await POST(req)
      expect(res.status).toBe(400)
    })
  })
})

describe("/api/admin/agents/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  const params = Promise.resolve({ id: "custom-1" })

  it("GET 返回 Agent 详情", async () => {
    mockRequireAdmin.mockResolvedValue(undefined)
    mockFindById.mockResolvedValue({ id: "custom-1", name: "自定义", isBuiltin: false })
    const { GET } = await import("@/app/api/admin/agents/[id]/route")
    const req = new Request("http://localhost/api/admin/agents/custom-1")
    const res = await GET(req, { params })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.agent.id).toBe("custom-1")
  })

  it("GET 不存在返回 404", async () => {
    mockRequireAdmin.mockResolvedValue(undefined)
    mockFindById.mockResolvedValue(null)
    const { GET } = await import("@/app/api/admin/agents/[id]/route")
    const req = new Request("http://localhost/api/admin/agents/custom-1")
    const res = await GET(req, { params })
    expect(res.status).toBe(404)
  })

  it("PUT 更新自定义 Agent", async () => {
    mockRequireAdmin.mockResolvedValue(undefined)
    mockUpdate.mockResolvedValue({ id: "custom-1", name: "改名", isBuiltin: false })
    const { PUT } = await import("@/app/api/admin/agents/[id]/route")
    const req = new Request("http://localhost/api/admin/agents/custom-1", {
      method: "PUT",
      body: JSON.stringify({ name: "改名" }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await PUT(req, { params })
    expect(res.status).toBe(200)
  })

  it("PUT 内置 Agent 返回 403", async () => {
    mockRequireAdmin.mockResolvedValue(undefined)
    mockUpdate.mockRejectedValue(new Error("内置 Agent 不可修改"))
    const { PUT } = await import("@/app/api/admin/agents/[id]/route")
    const req = new Request("http://localhost/api/admin/agents/custom-1", {
      method: "PUT",
      body: JSON.stringify({ name: "改名" }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await PUT(req, { params })
    expect(res.status).toBe(403)
  })

  it("DELETE 删除自定义 Agent", async () => {
    mockRequireAdmin.mockResolvedValue(undefined)
    mockDelete.mockResolvedValue(true)
    const { DELETE } = await import("@/app/api/admin/agents/[id]/route")
    const req = new Request("http://localhost/api/admin/agents/custom-1", { method: "DELETE" })
    const res = await DELETE(req, { params })
    expect(res.status).toBe(200)
  })

  it("DELETE 内置 Agent 返回 403", async () => {
    mockRequireAdmin.mockResolvedValue(undefined)
    mockDelete.mockRejectedValue(new Error("内置 Agent 不可删除"))
    const { DELETE } = await import("@/app/api/admin/agents/[id]/route")
    const req = new Request("http://localhost/api/admin/agents/custom-1", { method: "DELETE" })
    const res = await DELETE(req, { params })
    expect(res.status).toBe(403)
  })
})
