import { describe, it, expect } from "vitest"
import { maskUrl } from "@/mastra/tools/datasource/adapters/fetch-with-retry"
import { readFileSync } from "fs"
import { join } from "path"

describe("fetch-with-retry URL 脱敏", () => {
  it("maskUrl 脱敏 apikey 参数", () => {
    const result = maskUrl("https://api.example.com/data?apikey=secret123&format=json")
    expect(result).toContain("apikey=***")
    expect(result).not.toContain("secret123")
    expect(result).toContain("format=json")
  })

  it("maskUrl 脱敏 token 参数", () => {
    const result = maskUrl("https://api.example.com/data?access_token=abc123")
    expect(result).toContain("access_token=***")
    expect(result).not.toContain("abc123")
  })

  it("maskUrl 脱敏 password 参数", () => {
    const result = maskUrl("https://api.example.com/data?password=p@ss")
    expect(result).toContain("password=***")
  })

  it("maskUrl 保留无敏感信息的 URL", () => {
    const url = "https://api.example.com/data?page=1&limit=10"
    expect(maskUrl(url)).toBe(url)
  })

  it("maskUrl 对无效 URL 返回原字符串", () => {
    expect(maskUrl("not-a-url")).toBe("not-a-url")
  })

  it("日志中不直接使用原始 url 变量", () => {
    const source = readFileSync(
      join(process.cwd(), "src/mastra/tools/datasource/adapters/fetch-with-retry.ts"),
      "utf-8",
    )
    const logLines = source.split("\n").filter((l) => l.includes("console.log"))
    for (const line of logLines) {
      // 所有 console.log 中的 URL 应该用 maskUrl 包裹
      expect(line).toContain("maskUrl")
    }
  })
})
