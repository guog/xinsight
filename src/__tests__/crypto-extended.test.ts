import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { encrypt, decrypt } from "@/lib/crypto"

describe("crypto 加密/解密", () => {
  const originalEnv = process.env.ENCRYPTION_KEY

  beforeEach(() => {
    // 使用固定的测试密钥
    process.env.ENCRYPTION_KEY =
      "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2"
  })

  afterEach(() => {
    process.env.ENCRYPTION_KEY = originalEnv
  })

  it("加密后可以正确解密", () => {
    const plaintext = "sk-test-api-key-12345"
    const encrypted = encrypt(plaintext)
    const decrypted = decrypt(encrypted)
    expect(decrypted).toBe(plaintext)
  })

  it("加密结果格式为 iv:authTag:ciphertext", () => {
    const encrypted = encrypt("test")
    const parts = encrypted.split(":")
    expect(parts.length).toBe(3)
  })

  it("相同明文每次加密结果不同（随机 IV）", () => {
    const plaintext = "same-text"
    const enc1 = encrypt(plaintext)
    const enc2 = encrypt(plaintext)
    expect(enc1).not.toBe(enc2)
    // 但解密结果相同
    expect(decrypt(enc1)).toBe(plaintext)
    expect(decrypt(enc2)).toBe(plaintext)
  })

  it("解密无效格式抛出错误", () => {
    expect(() => decrypt("invalid")).toThrow("无效的加密格式")
    expect(() => decrypt("a:b")).toThrow("无效的加密格式")
  })

  it("解密被篡改的密文抛出错误", () => {
    const encrypted = encrypt("test")
    const parts = encrypted.split(":")
    // 篡改密文部分
    parts[2] = "AAAA" + parts[2]!.slice(4)
    expect(() => decrypt(parts.join(":"))).toThrow()
  })

  it("支持中文和特殊字符", () => {
    const plaintext = "你好世界！@#$%^&*()"
    const decrypted = decrypt(encrypt(plaintext))
    expect(decrypted).toBe(plaintext)
  })

  it("支持空字符串", () => {
    const decrypted = decrypt(encrypt(""))
    expect(decrypted).toBe("")
  })

  it("ENCRYPTION_KEY 缺失时使用 fallback（warning）", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    delete process.env.ENCRYPTION_KEY
    const encrypted = encrypt("test")
    expect(decrypt(encrypted)).toBe("test")
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})
