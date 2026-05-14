import { describe, it, expect } from "vitest"
import { resolve } from "path"

/** 与 wiki feedback 路由中相同的路径校验逻辑 */
function isPathSafe(wikiPath: string, pageId: string): boolean {
  const fullPath = resolve(wikiPath, pageId)
  const base = resolve(wikiPath) + "/"
  return fullPath.startsWith(base) || fullPath === resolve(wikiPath)
}

describe("wiki feedback pageId 路径校验", () => {
  const wikiPath = "/tmp/wiki"

  it("正常页面路径通过", () => {
    expect(isPathSafe(wikiPath, "page.md")).toBe(true)
    expect(isPathSafe(wikiPath, "sub/page.md")).toBe(true)
  })

  it("路径遍历 ../../ 被拦截", () => {
    expect(isPathSafe(wikiPath, "../../etc/passwd")).toBe(false)
    expect(isPathSafe(wikiPath, "../secret.txt")).toBe(false)
  })

  it("绝对路径被拦截", () => {
    // resolve("/tmp/wiki", "/etc/passwd") => "/etc/passwd"
    expect(isPathSafe(wikiPath, "/etc/passwd")).toBe(false)
  })

  it("隐含遍历 (sub/../../out) 被拦截", () => {
    expect(isPathSafe(wikiPath, "sub/../../out.txt")).toBe(false)
  })
})
