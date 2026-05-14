import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock auth
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

// Mock DB
const mockAll = vi.fn((): unknown[] => [])
const mockGet = vi.fn()
const mockRun = vi.fn()
const mockValues = vi.fn(() => ({ run: mockRun }))
vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        orderBy: () => ({ all: mockAll }),
        all: mockAll,
        where: () => ({ get: mockGet }),
      }),
    }),
    insert: () => ({ values: mockValues }),
  },
}))

vi.mock("@/db/schema", () => ({
  llmProviders: { id: "id", sortOrder: "sortOrder" },
  llmModels: { providerId: "providerId" },
}))

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => args),
}))

vi.mock("@/lib/models", () => ({
  invalidateModelCache: vi.fn(),
}))

describe("/api/admin/providers", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("GET 非管理员返回 403", async () => {
    mockRequireAdmin.mockRejectedValue(new Error("需要管理员权限"))

    const { GET } = await import("@/app/api/admin/providers/route")
    const res = await GET()
    expect(res.status).toBe(403)
  })

  it("GET 管理员返回提供商列表", async () => {
    mockRequireAdmin.mockResolvedValue(undefined)
    mockAll
      .mockReturnValueOnce([
        {
          id: "deepseek",
          name: "DeepSeek",
          apiKey: "sk-1234567890abcdef",
        },
      ])
      .mockReturnValueOnce([])

    const { GET } = await import("@/app/api/admin/providers/route")
    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.providers).toHaveLength(1)
    // apiKey 应被脱敏
    expect(data.providers[0].apiKey).toBe("sk-****cdef")
  })

  it("POST 缺少必填字段返回 400", async () => {
    mockRequireAdmin.mockResolvedValue(undefined)

    const { POST } = await import("@/app/api/admin/providers/route")
    const req = new Request("http://localhost/api/admin/providers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "test" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("POST 重复 ID 返回 409", async () => {
    mockRequireAdmin.mockResolvedValue(undefined)
    mockGet.mockReturnValue({ id: "existing" })

    const { POST } = await import("@/app/api/admin/providers/route")
    const req = new Request("http://localhost/api/admin/providers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "existing", name: "Test", baseUrl: "https://api.test.com" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(409)
  })

  it("POST 成功创建返回 201", async () => {
    mockRequireAdmin.mockResolvedValue(undefined)
    mockGet.mockReturnValue(undefined)

    const { POST } = await import("@/app/api/admin/providers/route")
    const req = new Request("http://localhost/api/admin/providers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "new-provider", name: "New", baseUrl: "https://api.new.com" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
  })
})
