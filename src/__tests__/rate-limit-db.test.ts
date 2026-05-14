import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock DB
const mockGet = vi.fn()
const mockRun = vi.fn()
vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          get: mockGet,
        }),
      }),
    }),
    insert: () => ({
      values: () => ({
        run: mockRun,
      }),
    }),
    delete: () => ({
      where: vi.fn().mockReturnValue({ run: vi.fn() }),
    }),
  },
}))

vi.mock("@/db/schema", () => ({
  rateLimits: { id: "id", ip: "ip", action: "action", createdAt: "created_at" },
}))

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => args),
  and: vi.fn((...args: unknown[]) => args),
  gt: vi.fn((...args: unknown[]) => args),
  sql: Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
    { raw: (s: string) => s },
  ),
}))

import { checkRateLimit, LOGIN_RATE_LIMIT } from "@/lib/rate-limit"

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("首次请求不限制", () => {
    // lockout 窗口查询返回 0，normal 窗口查询返回 0
    mockGet.mockReturnValueOnce({ count: 0 }).mockReturnValueOnce({ count: 0 })

    const result = checkRateLimit("1.2.3.4", "login", LOGIN_RATE_LIMIT)
    expect(result).toBe(false)
    expect(mockRun).toHaveBeenCalled() // 应记录请求
  })

  it("锁定期内直接拒绝", () => {
    // lockout 窗口查询返回超限
    mockGet.mockReturnValueOnce({ count: 5 })

    const result = checkRateLimit("1.2.3.4", "login", LOGIN_RATE_LIMIT)
    expect(result).toBe(true)
    expect(mockRun).not.toHaveBeenCalled() // 不记录
  })

  it("窗口内超限时返回 true", () => {
    // lockout 窗口未超限，normal 窗口已满
    mockGet.mockReturnValueOnce({ count: 3 }).mockReturnValueOnce({ count: 5 })

    const result = checkRateLimit("1.2.3.4", "login", LOGIN_RATE_LIMIT)
    expect(result).toBe(true)
  })
})
