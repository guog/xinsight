import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"

describe("mastra 权限检查 + Agent 注册 + Memory 路径", () => {
  describe("datasource 权限检查", () => {
    const source = readFileSync(
      join(process.cwd(), "src/mastra/tools/datasource/index.ts"),
      "utf-8",
    )

    it("无 agentId 时输出警告而非跳过检查", () => {
      expect(source).toContain("!agentId")
      expect(source).toMatch(/console\.warn.*缺少 agentId/)
    })

    it("有 agentId 时执行绑定检查", () => {
      expect(source).toContain("getAgentEndpointBindings(agentId)")
    })
  })

  describe("Agent 注册", () => {
    const source = readFileSync(join(process.cwd(), "src/mastra/index.ts"), "utf-8")

    it("autoAgent 已注册", () => {
      expect(source).toContain("autoAgent")
      expect(source).toMatch(/import.*autoAgent.*from.*auto-agent/)
    })

    it("researchAgent 已注册", () => {
      expect(source).toContain("researchAgent")
      expect(source).toMatch(/import.*researchAgent.*from.*research-agent/)
    })
  })

  describe("Memory 数据库路径", () => {
    const source = readFileSync(join(process.cwd(), "src/mastra/index.ts"), "utf-8")

    it("不使用相对路径 ./data/memory.db", () => {
      expect(source).not.toContain('"file:./data/memory.db"')
    })

    it("支持 MEMORY_DB_URL 环境变量覆盖", () => {
      expect(source).toContain("process.env.MEMORY_DB_URL")
    })

    it("默认使用 process.cwd() 构建绝对路径", () => {
      expect(source).toContain("process.cwd()")
    })
  })
})
