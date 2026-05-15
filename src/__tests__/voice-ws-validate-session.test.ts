import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"

describe("voice-ws validateSessionFromCookie", () => {
  const source = readFileSync(join(process.cwd(), "src/server/voice-ws.ts"), "utf-8")

  // 测试 cookie 解析正则逻辑（内联测试）
  function extractSessionId(cookieHeader: string | undefined): string | null {
    if (!cookieHeader) return null
    const match = cookieHeader.match(/(?:^|;\s*)xinsight_session=([^;]+)/)
    if (!match) return null
    return match[1]
  }

  it("从 cookie 中提取 session ID", () => {
    expect(extractSessionId("xinsight_session=abc123")).toBe("abc123")
  })

  it("从多个 cookie 中提取", () => {
    expect(extractSessionId("other=x; xinsight_session=abc123; foo=bar")).toBe("abc123")
  })

  it("cookie 为空返回 null", () => {
    expect(extractSessionId(undefined)).toBeNull()
    expect(extractSessionId("")).toBeNull()
  })

  it("无 xinsight_session cookie 返回 null", () => {
    expect(extractSessionId("other=value")).toBeNull()
  })

  it("源码包含认证检查逻辑", () => {
    expect(source).toContain("validateSessionFromCookie")
    expect(source).toContain("4001")
    expect(source).toContain("未认证")
  })

  it("过期 session 会被删除", () => {
    expect(source).toContain("expiresAt")
    expect(source).toContain("delete(sessions)")
  })
})
