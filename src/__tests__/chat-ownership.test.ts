import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock DB
const mockGet = vi.fn()
vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          get: mockGet,
        }),
      }),
    }),
  },
}))

vi.mock("@/db/schema", () => ({
  chats: { id: "id", userId: "user_id" },
}))

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => args),
  and: vi.fn((...args: unknown[]) => args),
}))

import { getOwnedChat } from "@/lib/chat-ownership"

describe("getOwnedChat", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("返回属于用户的对话", () => {
    const chat = { id: "chat-1", userId: "user-1", title: "测试" }
    mockGet.mockReturnValue(chat)

    const result = getOwnedChat("chat-1", "user-1")
    expect(result).toEqual(chat)
  })

  it("对话不存在时返回 undefined", () => {
    mockGet.mockReturnValue(undefined)

    const result = getOwnedChat("chat-999", "user-1")
    expect(result).toBeUndefined()
  })
})
