import { describe, test, expect, mock, beforeEach } from "bun:test"

// Mock modules
mock.module("@/lib/auth", () => ({
  requireAdmin: mock(),
  handleAuthError: mock(),
}))

mock.module("@/db", () => ({
  db: {},
}))

mock.module("@/db/repositories/datasource-repository", () => ({
  SqliteDatasourceRepository: mock(),
}))

mock.module("@/mastra/tools/datasource/adapters", () => ({
  getAdapter: mock(),
}))

mock.module("@/lib/schema/infer-schema", () => ({
  inferSchema: mock(),
}))

import { requireAdmin, handleAuthError } from "@/lib/auth"
import { SqliteDatasourceRepository } from "@/db/repositories/datasource-repository"
import { getAdapter } from "@/mastra/tools/datasource/adapters"
import { inferSchema } from "@/lib/schema/infer-schema"
import { POST } from "./route"

describe("POST /api/datasources/[id]/discover-schema", () => {
  const mockRepo = {
    findById: mock(),
    update: mock(),
  }

  beforeEach(() => {
    ;(requireAdmin as ReturnType<typeof mock>).mockReset()
    ;(handleAuthError as ReturnType<typeof mock>).mockReset()
    ;(getAdapter as ReturnType<typeof mock>).mockReset()
    ;(inferSchema as ReturnType<typeof mock>).mockReset()
    mockRepo.findById.mockReset()
    mockRepo.update.mockReset()
    ;(SqliteDatasourceRepository as ReturnType<typeof mock>).mockImplementation(() => mockRepo)
    ;(handleAuthError as ReturnType<typeof mock>).mockReturnValue(null)
  })

  test("非管理员返回 403", async () => {
    ;(requireAdmin as ReturnType<typeof mock>).mockRejectedValue(new Error("需要管理员权限"))
    ;(handleAuthError as ReturnType<typeof mock>).mockReturnValue(
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
    ;(requireAdmin as ReturnType<typeof mock>).mockResolvedValue({ id: "u1", role: "admin" })

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
      query: mock().mockResolvedValue({ data: [{ id: 1, name: "Alice" }] }),
    }
    ;(getAdapter as ReturnType<typeof mock>).mockReturnValue(mockAdapter)

    const mockFields = [
      { name: "id", type: "number" },
      { name: "name", type: "string" },
    ]
    ;(inferSchema as ReturnType<typeof mock>).mockReturnValue(mockFields)

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

    // Verify adapter was called with merged params
    expect(mockAdapter.query).toHaveBeenCalled()
    // Verify repo update was called
    expect(mockRepo.update).toHaveBeenCalled()
  })
})
