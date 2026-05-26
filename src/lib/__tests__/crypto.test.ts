import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { encrypt, decrypt } from "../crypto"

describe("crypto", () => {
  const originalEnv = process.env.ENCRYPTION_KEY

  beforeEach(() => {
    // 设置测试用密钥（32 字节 = 64 hex 字符）
    process.env.ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
  })

  afterEach(() => {
    process.env.ENCRYPTION_KEY = originalEnv
  })

  it("加密后解密应还原明文", () => {
    const plaintext = "sk-test-api-key-12345"
    const encrypted = encrypt(plaintext)
    const decrypted = decrypt(encrypted)
    expect(decrypted).toBe(plaintext)
  })

  it("加密结果格式为 iv:authTag:ciphertext", () => {
    const encrypted = encrypt("hello")
    const parts = encrypted.split(":")
    expect(parts).toHaveLength(3)
  })

  it("每次加密结果不同（随机 IV）", () => {
    const plaintext = "same-key"
    const a = encrypt(plaintext)
    const b = encrypt(plaintext)
    expect(a).not.toBe(b)
    // 但都能正确解密
    expect(decrypt(a)).toBe(plaintext)
    expect(decrypt(b)).toBe(plaintext)
  })

  it("解密无效格式应抛出错误", () => {
    expect(() => decrypt("invalid-string")).toThrow("无效的加密格式")
  })

  it("解密被篡改的密文应抛出错误", () => {
    const encrypted = encrypt("test")
    const parts = encrypted.split(":")
    // 篡改 ciphertext
    parts[2] = Buffer.from("tampered").toString("base64")
    expect(() => decrypt(parts.join(":"))).toThrow()
  })

  it("空字符串也能正确加密解密", () => {
    const encrypted = encrypt("")
    expect(decrypt(encrypted)).toBe("")
  })

  it("未设置 ENCRYPTION_KEY 时使用 fallback key 并 warn", () => {
    delete process.env.ENCRYPTION_KEY
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const encrypted = encrypt("fallback-test")
    expect(warnSpy).toHaveBeenCalled()
    const decrypted = decrypt(encrypted)
    expect(decrypted).toBe("fallback-test")
    warnSpy.mockRestore()
  })
})
