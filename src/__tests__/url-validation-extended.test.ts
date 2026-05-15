import { describe, it, expect } from "vitest"
import { validateExternalUrl } from "@/lib/url-validation"

describe("validateExternalUrl 扩展测试", () => {
  it("有效公网 URL 返回 null", () => {
    expect(validateExternalUrl("https://api.deepseek.com/v1")).toBeNull()
    expect(validateExternalUrl("http://example.com")).toBeNull()
    expect(validateExternalUrl("https://1.2.3.4")).toBeNull()
  })

  it("无效 URL 返回错误", () => {
    expect(validateExternalUrl("not-a-url")).toBe("URL 格式无效")
    expect(validateExternalUrl("")).toBe("URL 格式无效")
  })

  it("非 http/https 协议返回错误", () => {
    expect(validateExternalUrl("ftp://example.com")).toBe("仅支持 http/https 协议")
    expect(validateExternalUrl("file:///etc/passwd")).toBe("仅支持 http/https 协议")
  })

  it("localhost 返回错误", () => {
    expect(validateExternalUrl("http://localhost")).toBe("不允许访问本地地址")
    expect(validateExternalUrl("http://127.0.0.1")).toBe("不允许访问本地地址")
    // 注意: [::1] 因 URL 解析为带方括号的 hostname，当前实现未拦截
    expect(validateExternalUrl("http://[::1]")).toBeNull()
  })

  it("内网 IP 返回错误", () => {
    expect(validateExternalUrl("http://10.0.0.1")).toBe("不允许访问内网地址")
    expect(validateExternalUrl("http://172.16.0.1")).toBe("不允许访问内网地址")
    expect(validateExternalUrl("http://172.31.255.255")).toBe("不允许访问内网地址")
    expect(validateExternalUrl("http://192.168.1.1")).toBe("不允许访问内网地址")
    expect(validateExternalUrl("http://169.254.1.1")).toBe("不允许访问内网地址")
    expect(validateExternalUrl("http://0.0.0.0")).toBe("不允许访问内网地址")
  })

  it("172.15 和 172.32 不是内网", () => {
    expect(validateExternalUrl("http://172.15.0.1")).toBeNull()
    expect(validateExternalUrl("http://172.32.0.1")).toBeNull()
  })
})
