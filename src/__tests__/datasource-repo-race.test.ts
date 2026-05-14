import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"

describe("datasource-repository recordCall 原子递增", () => {
  const source = readFileSync(
    join(process.cwd(), "src/db/repositories/datasource-repository.ts"),
    "utf-8",
  )

  it("使用 SQL 表达式递增 callCount 而非先读后写", () => {
    // 应使用 sql`` 模板标签
    expect(source).toMatch(/callCount:\s*sql`/)
    // 不应有 current.callCount + 1 的模式
    expect(source).not.toContain("current.callCount + 1")
  })

  it("导入 sql 从 drizzle-orm", () => {
    expect(source).toMatch(/import\s*\{[^}]*sql[^}]*\}\s*from\s*["']drizzle-orm["']/)
  })

  it("recordCall 使用 returning() 避免额外查询", () => {
    expect(source).toContain(".returning()")
  })

  it("不存在时通过 returning 结果判断而非预查询", () => {
    // 不应先 findById 再 update
    const recordCallFn = source.match(/async recordCall\(id: string\)[^{]*\{([\s\S]*?)^\s*\}/m)
    expect(recordCallFn).toBeTruthy()
    // recordCall 函数体不应包含 findById
    expect(recordCallFn![1]).not.toContain("findById")
  })
})
