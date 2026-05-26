import { describe, test, expect, beforeEach, vi, type Mock } from "vitest"

const mockRepo = {
  findById: vi.fn(),
  update: vi.fn(),
}

// Mock modules
vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(),
  handleAuthError: vi.fn(),
}))

vi.mock("@/db", () => ({
  db: {},
}))

vi.mock("@/db/repositories/datasource-repository", () => ({
  SqliteDatasourceRepository: function () {
    return mockRepo
  },
}))

vi.mock("@/mastra/tools/datasource/adapters", () => ({
  getAdapter: vi.fn(),
}))

vi.mock("@/lib/schema/infer-schema", () => ({
  inferSchema: vi.fn(),
}))

import { requireAdmin, handleAuthError } from "@/lib/auth"
import { getAdapter } from "@/mastra/tools/datasource/adapters"
import { inferSchema } from "@/lib/schema/infer-schema"
import { POST } from "./route"

describe("POST /api/datasources/[id]/discover-schema", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(handleAuthError as Mock).mockReturnValue(null)
  })

  test("非管理员返回 403", async () => {
    ;(requireAdmin as Mock).mockRejectedValue(new Error("需要管理员权限"))
    ;(handleAuthError as Mock).mockReturnValue(
      Response.json({ error: "需要管理员权限" }, { status: 403 }),
    )

    const request = new Request("http://localhost/api/datasources/ds1/discover-schema", {
      method: "POST",
      body: JSON.stringify({ endpointId: "ep1" }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: "ds1" }) })
    expect(response.status).toBe(403)
  })

  test("成功发现 schema", async () => {
    ;(requireAdmin as Mock).mockResolvedValue({ id: "u1", role: "admin" })

    const mockDs = {
      id: "ds1",
      name: "Test DS",
      description: null,
      type: "rest",
      auth: { type: "none" },
      config: { baseUrl: "http://example.com" },
      endpoints: [{ id: "ep1", path: "/users", method: "GET" }],
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    mockRepo.findById.mockResolvedValue(mockDs)
    mockRepo.update.mockResolvedValue(mockDs)

    const mockAdapter = {
      query: vi.fn().mockResolvedValue({ data: [{ id: 1, name: "Alice" }] }),
    }
    ;(getAdapter as Mock).mockReturnValue(mockAdapter)

    const mockFields = [
      { name: "id", type: "number" },
      { name: "name", type: "string" },
    ]
    ;(inferSchema as Mock).mockReturnValue(mockFields)

    const request = new Request("http://localhost/api/datasources/ds1/discover-schema", {
      method: "POST",
      body: JSON.stringify({ endpointId: "ep1", params: { limit: 10 } }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: "ds1" }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.schema.fields).toEqual(mockFields)
    expect(body.schema.source).toBe("inferred")
    expect(body.schema.discoveredAt).toBeDefined()

    expect(mockAdapter.query).toHaveBeenCalled()
    expect(mockRepo.update).toHaveBeenCalled()
  })
})
