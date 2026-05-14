import { describe, it, expect } from "vitest"
import { validateExternalUrl } from "@/lib/url-validation"

describe("Provider sync baseUrl 校验", () => {
  it("正常外部 HTTPS URL 通过", () => {
    expect(validateExternalUrl("https://api.openai.com")).toBeNull()
    expect(validateExternalUrl("https://api.deepseek.com")).toBeNull()
  })

  it("localhost 被拦截", () => {
    expect(validateExternalUrl("http://localhost:11434")).not.toBeNull()
    expect(validateExternalUrl("http://127.0.0.1:11434")).not.toBeNull()
  })

  it("内网 IP 被拦截", () => {
    expect(validateExternalUrl("http://192.168.1.100:8080")).not.toBeNull()
    expect(validateExternalUrl("http://10.0.0.1:8080")).not.toBeNull()
  })

  it("非 HTTP 协议被拦截", () => {
    expect(validateExternalUrl("ftp://evil.com/models")).not.toBeNull()
    expect(validateExternalUrl("file:///etc/passwd")).not.toBeNull()
  })
})
