import { describe, it, expect, vi, beforeEach } from "vitest"
import { POST } from "../test-connection/route"

// Mock auth
vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(),
  handleAuthError: vi.fn((err: unknown) => {
    if (err instanceof Error && err.message === "未登录") {
      return Response.json({ error: "未登录" }, { status: 401 })
    }
    return null
  }),
}))

// Mock adapters
vi.mock("@/mastra/tools/datasource/adapters", () => ({
  getAdapter: vi.fn(),
}))

import { requireAdmin } from "@/lib/auth"
import { getAdapter } from "@/mastra/tools/datasource/adapters"

const mockRequireAdmin = requireAdmin as ReturnType<typeof vi.fn>
const mockGetAdapter = getAdapter as ReturnType<typeof vi.fn>

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/datasources/test-connection", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/datasources/test-connection", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAdmin.mockResolvedValue(undefined)
  })

  it("未登录返回 401", async () => {
    mockRequireAdmin.mockRejectedValue(new Error("未登录"))
    const res = await POST(makeRequest({ type: "rest" }))
    expect(res.status).toBe(401)
  })

  it("缺少 type 返回 400", async () => {
    const res = await POST(makeRequest({ config: {} }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain("类型")
  })

  it("不支持的类型返回 400", async () => {
    mockGetAdapter.mockReturnValue(null)
    const res = await POST(makeRequest({ type: "unknown" }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain("不支持")
  })

  it("连接成功返回 ok:true 和 latency", async () => {
    const mockAdapter = {
      testConnection: vi.fn().mockResolvedValue({ ok: true, message: "连接成功" }),
    }
    mockGetAdapter.mockReturnValue(mockAdapter)

    const res = await POST(makeRequest({ type: "rest", config: { baseUrl: "http://example.com" } }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.message).toBe("连接成功")
    expect(typeof data.latency).toBe("number")
    expect(data.latency).toBeGreaterThanOrEqual(0)
  })

  it("连接失败返回 ok:false 和错误信息", async () => {
    const mockAdapter = {
      testConnection: vi.fn().mockResolvedValue({ ok: false, message: "Connection refused" }),
    }
    mockGetAdapter.mockReturnValue(mockAdapter)

    const res = await POST(makeRequest({ type: "mqtt", config: { brokerUrl: "tcp://bad" } }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(false)
    expect(data.message).toBe("Connection refused")
    expect(typeof data.latency).toBe("number")
  })

  it("测量并返回延迟时间", async () => {
    const mockAdapter = {
      testConnection: vi.fn().mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 50))
        return { ok: true, message: "ok" }
      }),
    }
    mockGetAdapter.mockReturnValue(mockAdapter)

    const res = await POST(makeRequest({ type: "rest", config: {} }))
    const data = await res.json()
    expect(data.latency).toBeGreaterThanOrEqual(40)
  })
})
