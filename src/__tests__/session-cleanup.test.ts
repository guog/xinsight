import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock drizzle
const mockRun = vi.fn()
const mockWhere = vi.fn(() => ({ run: mockRun }))
const mockDelete = vi.fn(() => ({ where: mockWhere }))
const mockDb = { delete: mockDelete }

vi.mock("@/db", () => ({
  db: mockDb,
}))

vi.mock("@/db/schema", () => ({
  sessions: { expiresAt: "expiresAt" },
  users: {},
}))

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}))

describe("cleanExpiredSessions", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockDelete.mockReturnValue({ where: mockWhere })
    mockWhere.mockReturnValue({ run: mockRun })
  })

  it("删除过期 session", async () => {
    const { cleanExpiredSessions } = await import("@/lib/auth")
    cleanExpiredSessions()
    expect(mockDelete).toHaveBeenCalled()
    expect(mockWhere).toHaveBeenCalled()
    expect(mockRun).toHaveBeenCalled()
  })
})
