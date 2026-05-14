import { describe, it, expect } from "vitest"

/** 与 login/page.tsx 中相同的 redirect 校验逻辑 */
function sanitizeRedirect(raw: string | null): string {
  const value = raw || "/"
  return value.startsWith("/") && !value.startsWith("//") ? value : "/"
}

describe("登录页 redirect 参数校验", () => {
  it("正常站内路径通过", () => {
    expect(sanitizeRedirect("/dashboard")).toBe("/dashboard")
    expect(sanitizeRedirect("/chat/123")).toBe("/chat/123")
  })

  it("null 或空值默认为 /", () => {
    expect(sanitizeRedirect(null)).toBe("/")
    expect(sanitizeRedirect("")).toBe("/")
  })

  it("外部 URL 被拦截为 /", () => {
    expect(sanitizeRedirect("https://evil.com")).toBe("/")
    expect(sanitizeRedirect("http://evil.com")).toBe("/")
  })

  it("协议相对 URL (//evil.com) 被拦截", () => {
    expect(sanitizeRedirect("//evil.com")).toBe("/")
    expect(sanitizeRedirect("//evil.com/path")).toBe("/")
  })

  it("javascript: 协议被拦截", () => {
    expect(sanitizeRedirect("javascript:alert(1)")).toBe("/")
  })
})
