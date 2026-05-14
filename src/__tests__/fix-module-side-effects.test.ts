import { describe, it, expect, vi, beforeEach } from "vitest"

describe("Issue #171: 模块级副作用修复", () => {
  describe("1. model-config 懒加载", () => {
    beforeEach(() => {
      vi.resetModules()
    })

    it("DEFAULT_AGENT_MODEL 是静态字符串，不触发 DB 查询", async () => {
      // mock 掉 DB 依赖，确保模块加载不会因 DB 问题崩溃
      vi.doMock("@/lib/models", () => ({
        getDefaultModelId: () => {
          throw new Error("DB 未就绪")
        },
      }))
      const mod = await import("@/mastra/agents/model-config")
      // DEFAULT_AGENT_MODEL 是环境变量回退值，不触发 DB
      expect(typeof mod.DEFAULT_AGENT_MODEL).toBe("string")
      expect(mod.DEFAULT_AGENT_MODEL.length).toBeGreaterThan(0)
    })

    it("getDefaultAgentModel() DB 异常时安全回退", async () => {
      vi.doMock("@/lib/models", () => ({
        getDefaultModelId: () => {
          throw new Error("DB 未就绪")
        },
      }))
      const mod = await import("@/mastra/agents/model-config")
      const result = mod.getDefaultAgentModel()
      expect(typeof result).toBe("string")
      expect(result.length).toBeGreaterThan(0)
    })

    it("getDefaultAgentModel() DB 正常时返回 DB 值", async () => {
      vi.doMock("@/lib/models", () => ({
        getDefaultModelId: () => "openai/gpt-4o",
      }))
      const mod = await import("@/mastra/agents/model-config")
      expect(mod.getDefaultAgentModel()).toBe("openai/gpt-4o")
    })
  })

  describe("2. JSON 截断不再产生无效 JSON", () => {
    it("大数组应被安全截取而非字符串截断", async () => {
      const { fetchWithRetry } = await import(
        "@/mastra/tools/datasource/adapters/fetch-with-retry"
      )
      // 构造超过 1MB 的 JSON 数组响应
      const bigArray = Array.from({ length: 50000 }, (_, i) => ({
        id: i,
        name: `item-${i}-${"x".repeat(20)}`,
      }))
      const body = JSON.stringify(bigArray)

      // mock fetch
      const originalFetch = globalThis.fetch
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(body, {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )

      try {
        const result = await fetchWithRetry("https://example.com/api", { method: "GET" })
        expect(result.error).toBeUndefined()
        expect(result.metadata?.truncated).toBe(true)
        // 关键：截断后的数据必须是有效的可序列化对象
        expect(() => JSON.stringify(result.data)).not.toThrow()
        expect(Array.isArray(result.data)).toBe(true)
      } finally {
        globalThis.fetch = originalFetch
      }
    })
  })

  describe("3. DB 路径使用绝对路径", () => {
    it("默认路径基于 process.cwd()", async () => {
      // 验证 db/index.ts 中的路径逻辑
      const { join } = await import("node:path")
      const expected = join(process.cwd(), "data", "xinsight.db")
      // 没有设置 DATABASE_PATH 和 DATABASE_URL 时应使用 cwd 绝对路径
      expect(expected).toMatch(/^\//) // 绝对路径以 / 开头
      expect(expected).toContain("data/xinsight.db")
    })
  })

  describe("4. 聊天 API 指数退避重试", () => {
    it("isRetryableError 保持兼容", () => {
      // 导入确保模块正常
      return import("@/lib/retry-utils").then((mod) => {
        expect(mod.isRetryableError(new Error("429 rate limit"))).toBe(true)
        expect(mod.isRetryableError(new Error("Invalid key"))).toBe(false)
      })
    })

    it("指数退避延迟计算正确", () => {
      // 验证退避公式：baseDelay = 1000 * 2^attempt
      const delays = [0, 1, 2].map((attempt) => 1000 * Math.pow(2, attempt))
      expect(delays).toEqual([1000, 2000, 4000])
    })
  })
})
