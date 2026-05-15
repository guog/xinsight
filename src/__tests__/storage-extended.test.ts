import { describe, it, expect, beforeEach, vi } from "vitest"

// Mock localStorage
const store: Record<string, string> = {}
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    store[key] = value
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key]
  }),
  clear: vi.fn(() => {
    Object.keys(store).forEach((k) => delete store[k])
  }),
}
vi.stubGlobal("localStorage", localStorageMock)

import {
  getStoredModelId,
  setStoredModelId,
  getConversations,
  saveConversation,
  deleteConversation,
  getStoredTheme,
  setStoredTheme,
  type Conversation,
} from "@/lib/storage"

describe("storage 工具", () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  describe("modelId", () => {
    it("默认返回 null", () => {
      expect(getStoredModelId()).toBeNull()
    })

    it("设置后可读取", () => {
      setStoredModelId("deepseek/deepseek-chat")
      expect(getStoredModelId()).toBe("deepseek/deepseek-chat")
    })
  })

  describe("conversations", () => {
    const mockConv: Conversation = {
      id: "conv-1",
      title: "测试对话",
      messages: [{ id: "m-1", role: "user", content: "你好", createdAt: Date.now() }],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    it("默认返回空数组", () => {
      expect(getConversations()).toEqual([])
    })

    it("保存新对话", () => {
      saveConversation(mockConv)
      const convs = getConversations()
      expect(convs.length).toBe(1)
      expect(convs[0]!.id).toBe("conv-1")
    })

    it("更新已有对话", () => {
      saveConversation(mockConv)
      saveConversation({ ...mockConv, title: "更新标题" })
      const convs = getConversations()
      expect(convs.length).toBe(1)
      expect(convs[0]!.title).toBe("更新标题")
    })

    it("删除对话", () => {
      saveConversation(mockConv)
      deleteConversation("conv-1")
      expect(getConversations()).toEqual([])
    })

    it("解析失败返回空数组", () => {
      store["xinsight:conversations"] = "invalid json"
      expect(getConversations()).toEqual([])
    })
  })

  describe("theme", () => {
    it("默认返回 system", () => {
      expect(getStoredTheme()).toBe("system")
    })

    it("设置后可读取", () => {
      setStoredTheme("dark")
      expect(getStoredTheme()).toBe("dark")
    })
  })
})
