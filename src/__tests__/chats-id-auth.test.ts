import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock auth
const mockRequireAuth = vi.fn()
vi.mock("@/lib/auth", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
  handleAuthError: (error: unknown) => {
    if (error instanceof Error && error.message === "未登录") {
      return Response.json({ error: "未登录" }, { status: 401 })
    }
    return Response.json({ error: "未知认证错误" }, { status: 500 })
  },
}))

// Mock DB
const mockGet = vi.fn()
const mockSelect = vi.fn(() => ({
  from: vi.fn(() => ({
    where: vi.fn(() => ({
      get: mockGet,
      orderBy: vi.fn(() => []),
    })),
  })),
}))
const mockUpdate = vi.fn(() => ({
  set: vi.fn(() => ({
    where: vi.fn(() => ({
      returning: vi.fn(() => [{ id: "chat-1", title: "updated" }]),
    })),
  })),
}))
const mockDeleteWhere = vi.fn()
const mockDelete = vi.fn(() => ({
  where: mockDeleteWhere,
}))
const mockInsert = vi.fn(() => ({
  values: vi.fn(),
}))

vi.mock("@/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
  },
}))

vi.mock("@/db/schema", () => ({
  chats: { id: "id", userId: "userId" },
  messages: { chatId: "chatId", createdAt: "createdAt" },
}))

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => args),
  and: vi.fn((...args: unknown[]) => args),
}))

const fakeUser = { id: "user-1", username: "test", displayName: "测试", role: "user" }

describe("/api/chats/[id] 认证与所有权", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("GET 未登录返回 401", async () => {
    mockRequireAuth.mockRejectedValue(new Error("未登录"))

    const { GET } = await import("@/app/api/chats/[id]/route")
    const req = new Request("http://localhost/api/chats/abc")
    const res = await GET(req, { params: Promise.resolve({ id: "abc" }) })
    expect(res.status).toBe(401)
  })

  it("GET 其他用户的对话返回 404", async () => {
    mockRequireAuth.mockResolvedValue(fakeUser)
    mockGet.mockReturnValue(undefined) // ownership check fails

    const { GET } = await import("@/app/api/chats/[id]/route")
    const req = new Request("http://localhost/api/chats/abc")
    const res = await GET(req, { params: Promise.resolve({ id: "abc" }) })
    expect(res.status).toBe(404)
  })

  it("DELETE 未登录返回 401", async () => {
    mockRequireAuth.mockRejectedValue(new Error("未登录"))

    const { DELETE } = await import("@/app/api/chats/[id]/route")
    const req = new Request("http://localhost/api/chats/abc", { method: "DELETE" })
    const res = await DELETE(req, { params: Promise.resolve({ id: "abc" }) })
    expect(res.status).toBe(401)
  })

  it("PATCH 其他用户的对话返回 404", async () => {
    mockRequireAuth.mockResolvedValue(fakeUser)
    mockGet.mockReturnValue(undefined)

    const { PATCH } = await import("@/app/api/chats/[id]/route")
    const req = new Request("http://localhost/api/chats/abc", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "hacked" }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: "abc" }) })
    expect(res.status).toBe(404)
  })
})

describe("/api/chats/[id]/messages 认证与所有权", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("GET 未登录返回 401", async () => {
    mockRequireAuth.mockRejectedValue(new Error("未登录"))

    const { GET } = await import("@/app/api/chats/[id]/messages/route")
    const req = new Request("http://localhost/api/chats/abc/messages")
    const res = await GET(req, { params: Promise.resolve({ id: "abc" }) })
    expect(res.status).toBe(401)
  })

  it("POST 其他用户的对话返回 404", async () => {
    mockRequireAuth.mockResolvedValue(fakeUser)
    mockGet.mockReturnValue(undefined)

    const { POST } = await import("@/app/api/chats/[id]/messages/route")
    const req = new Request("http://localhost/api/chats/abc/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "user", parts: "hello" }),
    })
    const res = await POST(req, { params: Promise.resolve({ id: "abc" }) })
    expect(res.status).toBe(404)
  })
})
