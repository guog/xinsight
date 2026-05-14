import { describe, test, expect, vi } from "vitest"
import { NextRequest } from "next/server"

// 设置环境变量
vi.stubEnv("SESSION_SECRET", "test-secret-key-for-hmac-signing-1234")

import { signSessionId } from "@/lib/session-sign"
import { middleware } from "@/middleware"

function createRequest(
  path: string,
  cookies: Record<string, string> = {},
  options: { method?: string; headers?: Record<string, string> } = {},
) {
  const url = new URL(path, "http://localhost:3000")
  const headers = new Headers({
    "user-agent": "Mozilla/5.0",
    host: "localhost:3000",
    ...options.headers,
  })
  const req = new NextRequest(url, { method: options.method || "GET", headers })
  for (const [k, v] of Object.entries(cookies)) {
    req.cookies.set(k, v)
  }
  return req
}

describe("middleware 认证守卫", () => {
  test("未登录访问 / 应重定向到 /login", async () => {
    const res = await middleware(createRequest("/"))
    expect(res.status).toBe(307)
    const location = res.headers.get("location")!
    expect(location).toContain("/login")
    expect(location).toContain("redirect=%2F")
  })

  test("未登录访问 /settings 应重定向到 /login", async () => {
    const res = await middleware(createRequest("/settings"))
    expect(res.status).toBe(307)
    const location = res.headers.get("location")!
    expect(location).toContain("/login")
    expect(location).toContain("redirect=%2Fsettings")
  })

  test("未登录访问 /login 应放行", async () => {
    const res = await middleware(createRequest("/login"))
    expect(res.status).toBe(200)
  })

  test("未登录访问 /register 应放行", async () => {
    const res = await middleware(createRequest("/register"))
    expect(res.status).toBe(200)
  })

  test("已登录（签名 cookie）访问 / 应放行", async () => {
    const signed = await signSessionId("valid-session-id")
    const res = await middleware(createRequest("/", { xinsight_session: signed }))
    expect(res.status).toBe(200)
  })

  test("伪造 cookie（无签名）应重定向到 /login", async () => {
    const res = await middleware(createRequest("/", { xinsight_session: "fake-session" }))
    expect(res.status).toBe(307)
    const location = res.headers.get("location")!
    expect(location).toContain("/login")
  })

  test("篡改签名的 cookie 应重定向到 /login", async () => {
    const signed = await signSessionId("valid-session-id")
    const tampered = signed.slice(0, -1) + "0"
    const res = await middleware(createRequest("/", { xinsight_session: tampered }))
    expect(res.status).toBe(307)
  })

  test("伪造 cookie 访问 API 应返回 401", async () => {
    const res = await middleware(createRequest("/api/chat", { xinsight_session: "fake" }))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe("会话无效")
  })

  test("未登录访问 /api/chat 应返回 401 JSON", async () => {
    const res = await middleware(createRequest("/api/chat"))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe("未登录")
  })

  test("未登录访问 /api/auth/login 应放行", async () => {
    const res = await middleware(createRequest("/api/auth/login"))
    expect(res.status).toBe(200)
  })

  test("未登录访问 /api/auth/register 应放行", async () => {
    const res = await middleware(createRequest("/api/auth/register"))
    expect(res.status).toBe(200)
  })

  test("已登录访问 /api/chat 应放行", async () => {
    const signed = await signSessionId("valid")
    const res = await middleware(createRequest("/api/chat", { xinsight_session: signed }))
    expect(res.status).toBe(200)
  })

  test("设置 x-device cookie", async () => {
    const res = await middleware(createRequest("/login"))
    const setCookie = res.headers.getSetCookie()
    const deviceCookie = setCookie.find((c) => c.startsWith("x-device="))
    expect(deviceCookie).toBeTruthy()
  })
})

describe("middleware CSRF 防护", () => {
  test("POST 请求无 Origin/Referer 应返回 403", async () => {
    const signed = await signSessionId("valid")
    const res = await middleware(
      createRequest("/api/chat", { xinsight_session: signed }, { method: "POST" }),
    )
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe("CSRF 校验失败")
  })

  test("POST 请求 Origin 匹配应放行", async () => {
    const signed = await signSessionId("valid")
    const res = await middleware(
      createRequest(
        "/api/chat",
        { xinsight_session: signed },
        { method: "POST", headers: { origin: "http://localhost:3000" } },
      ),
    )
    expect(res.status).toBe(200)
  })

  test("POST 请求 Origin 不匹配应返回 403", async () => {
    const signed = await signSessionId("valid")
    const res = await middleware(
      createRequest(
        "/api/chat",
        { xinsight_session: signed },
        { method: "POST", headers: { origin: "http://evil.com" } },
      ),
    )
    expect(res.status).toBe(403)
  })

  test("POST 请求用 Referer 回退校验", async () => {
    const signed = await signSessionId("valid")
    const res = await middleware(
      createRequest(
        "/api/chat",
        { xinsight_session: signed },
        { method: "POST", headers: { referer: "http://localhost:3000/page" } },
      ),
    )
    expect(res.status).toBe(200)
  })

  test("DELETE 请求也需要 CSRF 校验", async () => {
    const signed = await signSessionId("valid")
    const res = await middleware(
      createRequest("/api/chat", { xinsight_session: signed }, { method: "DELETE" }),
    )
    expect(res.status).toBe(403)
  })

  test("GET 请求不需要 CSRF 校验", async () => {
    const signed = await signSessionId("valid")
    const res = await middleware(
      createRequest("/api/chat", { xinsight_session: signed }, { method: "GET" }),
    )
    expect(res.status).toBe(200)
  })

  test("公开 API（/api/auth/login）POST 不做 CSRF 校验", async () => {
    const res = await middleware(
      createRequest("/api/auth/login", {}, { method: "POST" }),
    )
    expect(res.status).toBe(200)
  })
})
