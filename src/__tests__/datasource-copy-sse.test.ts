import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"

describe("数据源复制 ID 冲突", () => {
  const source = readFileSync(
    join(process.cwd(), "src/app/api/datasources/[id]/duplicate/route.ts"),
    "utf-8",
  )

  it("复制 ID 包含时间戳避免冲突", () => {
    expect(source).toContain("Date.now()")
    // 不应使用固定的 `-copy` 后缀
    expect(source).not.toMatch(/newId\s*=\s*`\$\{id\}-copy`/)
  })
})

describe("SSE 流客户端断开检测", () => {
  const source = readFileSync(
    join(process.cwd(), "src/app/api/wiki/admin/tasks/[id]/stream/route.ts"),
    "utf-8",
  )

  it("ReadableStream 包含 cancel 回调", () => {
    expect(source).toContain("cancel()")
  })

  it("cancel 回调中清除 interval", () => {
    expect(source).toMatch(/cancel\(\)\s*\{[\s\S]*?clearInterval/)
  })

  it("enqueue 包含 try-catch 防护", () => {
    expect(source).toMatch(/try\s*\{[\s\S]*?controller\.enqueue[\s\S]*?\}\s*catch/)
  })
})
