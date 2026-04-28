import { describe, it, expect, beforeEach, vi } from "vitest"
import {
  getStoredModelId,
  setStoredModelId,
  getConversations,
  saveConversation,
  deleteConversation,
  getStoredTheme,
  setStoredTheme,
  type Conversation,
} from "./storage"

// 模拟 localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
  }
})()

Object.defineProperty(globalThis, "localStorage", { value: localStorageMock })

describe("存储工具", () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  describe("模型设置", () => {
    it("默认应该返回 null", () => {
      expect(getStoredModelId()).toBeNull()
    })

    it("应该能存储和读取模型 ID", () => {
      setStoredModelId("openai/gpt-4o")
      expect(getStoredModelId()).toBe("openai/gpt-4o")
    })
  })

  describe("对话历史", () => {
    it("默认应该返回空数组", () => {
      expect(getConversations()).toEqual([])
    })

    it("应该能保存和读取对话", () => {
      const conv: Conversation = {
        id: "conv-1",
        title: "测试对话",
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      saveConversation(conv)
      const convs = getConversations()
      expect(convs).toHaveLength(1)
      expect(convs[0].id).toBe("conv-1")
    })

    it("应该能删除对话", () => {
      const conv: Conversation = {
        id: "conv-1",
        title: "测试对话",
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      saveConversation(conv)
      deleteConversation("conv-1")
      expect(getConversations()).toHaveLength(0)
    })

    it("更新已有对话时应该覆盖", () => {
      const conv: Conversation = {
        id: "conv-1",
        title: "原标题",
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      saveConversation(conv)
      saveConversation({ ...conv, title: "新标题" })
      const convs = getConversations()
      expect(convs).toHaveLength(1)
      expect(convs[0].title).toBe("新标题")
    })
  })

  describe("主题设置", () => {
    it("默认应该返回 system", () => {
      expect(getStoredTheme()).toBe("system")
    })

    it("应该能存储和读取主题", () => {
      setStoredTheme("dark")
      expect(getStoredTheme()).toBe("dark")
    })
  })
})
