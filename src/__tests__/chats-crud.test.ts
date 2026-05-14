import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock auth
const mockGetCurrentUser = vi.fn()
vi.mock("@/lib/auth", () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}))

// Mock DB
const mockAll = vi.fn((): unknown[] => [])
const mockInsertValues = vi.fn()
vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => mockAll(),
        }),
      }),
    }),
    insert: () => ({ values: mockInsertValues }),
  },
}))

vi.mock("@/db/schema", () => ({
  chats: { id: "id", userId: "userId", updatedAt: "updatedAt" },
}))

vi.mock("drizzle-orm", () => ({
  desc: vi.fn((col) => col),
  eq: vi.fn((...args: unknown[]) => args),
}))

vi.mock("@/lib/api-schemas", () => ({
  CreateChatSchema: {
    safeParse: (data: unknown) => {
      if (typeof data === "object" && data !== null) {
        return { success: true, data }
      }
      return { success: false, error: { issues: [{ message: "invalid" }] } }
    },
  },
}))

const fakeUser = { id: "user-1", username: "test", displayName: "测试", role: "user" }

describe("/api/chats CRUD", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("GET 未登录返回 401", async () => {
    mockGetCurrentUser.mockResolvedValue(null)

    const { GET } = await import("@/app/api/chats/route")
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it("GET 已登录返回对话列表", async () => {
    mockGetCurrentUser.mockResolvedValue(fakeUser)
    mockAll.mockReturnValue([{ id: "chat-1", title: "测试对话" }])

    const { GET } = await import("@/app/api/chats/route")
    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveLength(1)
    expect(data[0].title).toBe("测试对话")
  })

  it("POST 未登录返回 401", async () => {
    mockGetCurrentUser.mockResolvedValue(null)

    const { POST } = await import("@/app/api/chats/route")
    const req = new Request("http://localhost/api/chats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "新对话" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it("POST 创建对话返回 201", async () => {
    mockGetCurrentUser.mockResolvedValue(fakeUser)

    const { POST } = await import("@/app/api/chats/route")
    const req = new Request("http://localhost/api/chats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "新对话", agentId: "chatAgent" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.title).toBe("新对话")
    expect(data.userId).toBe("user-1")
  })
})
