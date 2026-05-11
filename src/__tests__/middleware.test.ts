import { describe, test, expect } from "vitest"
import { NextRequest } from "next/server"
import { middleware } from "@/middleware"

function createRequest(path: string, cookies: Record<string, string> = {}) {
  const url = new URL(path, "http://localhost:3000")
  const headers = new Headers({ "user-agent": "Mozilla/5.0" })
  const req = new NextRequest(url, { headers })
  for (const [k, v] of Object.entries(cookies)) {
    req.cookies.set(k, v)
  }
  return req
}

describe("middleware 认证守卫", () => {
  test("未登录访问 / 应重定向到 /login", () => {
    const res = middleware(createRequest("/"))
    expect(res.status).toBe(307)
    const location = res.headers.get("location")!
    expect(location).toContain("/login")
    expect(location).toContain("redirect=%2F")
  })

  test("未登录访问 /settings 应重定向到 /login", () => {
    const res = middleware(createRequest("/settings"))
    expect(res.status).toBe(307)
    const location = res.headers.get("location")!
    expect(location).toContain("/login")
    expect(location).toContain("redirect=%2Fsettings")
  })

  test("未登录访问 /login 应放行", () => {
    const res = middleware(createRequest("/login"))
    expect(res.status).toBe(200)
  })

  test("未登录访问 /register 应放行", () => {
    const res = middleware(createRequest("/register"))
    expect(res.status).toBe(200)
  })

  test("已登录访问 / 应放行", () => {
    const res = middleware(createRequest("/", { xinsight_session: "valid-session-id" }))
    expect(res.status).toBe(200)
  })

  test("已登录访问 /admin/datasources 应放行", () => {
    const res = middleware(createRequest("/admin/datasources", { xinsight_session: "abc123" }))
    expect(res.status).toBe(200)
  })

  test("未登录访问 /api/chat 应返回 401 JSON", async () => {
    const res = middleware(createRequest("/api/chat"))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe("未登录")
  })

  test("未登录访问 /api/datasources 应返回 401", async () => {
    const res = middleware(createRequest("/api/datasources"))
    expect(res.status).toBe(401)
  })

  test("未登录访问 /api/auth/login 应放行", () => {
    const res = middleware(createRequest("/api/auth/login"))
    expect(res.status).toBe(200)
  })

  test("未登录访问 /api/auth/register 应放行", () => {
    const res = middleware(createRequest("/api/auth/register"))
    expect(res.status).toBe(200)
  })

  test("已登录访问 /api/chat 应放行", () => {
    const res = middleware(createRequest("/api/chat", { xinsight_session: "valid" }))
    expect(res.status).toBe(200)
  })

  test("设置 x-device cookie", () => {
    const res = middleware(createRequest("/login"))
    const setCookie = res.headers.getSetCookie()
    const deviceCookie = setCookie.find((c) => c.startsWith("x-device="))
    expect(deviceCookie).toBeTruthy()
  })
})
