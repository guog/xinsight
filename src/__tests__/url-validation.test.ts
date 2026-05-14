import { describe, it, expect } from "vitest"
import { validateExternalUrl } from "@/lib/url-validation"

describe("validateExternalUrl SSRF 防护", () => {
  it("允许正常外部 URL", () => {
    expect(validateExternalUrl("https://api.example.com/openapi.json")).toBeNull()
    expect(validateExternalUrl("http://example.com:8080/api")).toBeNull()
  })

  it("拒绝 localhost", () => {
    expect(validateExternalUrl("http://localhost/api")).not.toBeNull()
    expect(validateExternalUrl("http://127.0.0.1/api")).not.toBeNull()
  })

  it("拒绝内网 IP", () => {
    expect(validateExternalUrl("http://10.0.0.1/api")).not.toBeNull()
    expect(validateExternalUrl("http://192.168.1.1/api")).not.toBeNull()
    expect(validateExternalUrl("http://172.16.0.1/api")).not.toBeNull()
    expect(validateExternalUrl("http://169.254.169.254/metadata")).not.toBeNull()
  })

  it("拒绝非 http/https 协议", () => {
    expect(validateExternalUrl("ftp://example.com/file")).not.toBeNull()
    expect(validateExternalUrl("file:///etc/passwd")).not.toBeNull()
  })

  it("拒绝无效 URL", () => {
    expect(validateExternalUrl("not-a-url")).not.toBeNull()
  })
})
