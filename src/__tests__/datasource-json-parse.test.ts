import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"

describe("datasource-repository JSON.parse 安全处理", () => {
  const source = readFileSync(
    join(process.cwd(), "src/db/repositories/datasource-repository.ts"),
    "utf-8",
  )

  it("定义 safeJsonParse 函数", () => {
    expect(source).toContain("function safeJsonParse")
  })

  it("toRecord 中使用 safeJsonParse 而非直接 JSON.parse", () => {
    // toRecord 函数体不应包含直接的 JSON.parse
    const toRecordFn = source.match(/function toRecord\([^)]*\)[^{]*\{([\s\S]*?)^}/m)
    expect(toRecordFn).toBeTruthy()
    expect(toRecordFn![1]).not.toContain("JSON.parse")
    expect(toRecordFn![1]).toContain("safeJsonParse")
  })

  it("safeJsonParse 包含 try-catch", () => {
    const fn = source.match(/function safeJsonParse[\s\S]*?^}/m)
    expect(fn).toBeTruthy()
    expect(fn![0]).toContain("try")
    expect(fn![0]).toContain("catch")
  })

  it("getAgentEndpointBindings 也使用 safeJsonParse", () => {
    expect(source).toMatch(/endpointIds.*safeJsonParse/)
  })
})
