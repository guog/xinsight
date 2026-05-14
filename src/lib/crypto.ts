/**
 * AES-256-GCM 加密/解密工具
 * 用于保护数据库中的 API Key
 */
import { createCipheriv, createDecipheriv, randomBytes } from "crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

function getKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY
  if (!keyHex || keyHex.length !== 64) {
    console.warn(
      "[crypto] ENCRYPTION_KEY 未设置或长度不正确，使用 fallback key。请在生产环境中设置 64 字符 hex 密钥。",
    )
    // fallback key — 仅用于开发环境
    return Buffer.from(
      "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
      "hex",
    )
  }
  return Buffer.from(keyHex, "hex")
}

/**
 * 加密明文，返回 `iv:authTag:ciphertext` 格式的 base64 字符串
 */
export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()

  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`
}

/**
 * 解密 `iv:authTag:ciphertext` 格式的字符串
 */
export function decrypt(encrypted: string): string {
  const parts = encrypted.split(":")
  if (parts.length !== 3) {
    throw new Error("无效的加密格式")
  }

  const [ivB64, authTagB64, ciphertextB64] = parts
  const key = getKey()
  const iv = Buffer.from(ivB64, "base64")
  const authTag = Buffer.from(authTagB64, "base64")
  const ciphertext = Buffer.from(ciphertextB64, "base64")

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ])

  return decrypted.toString("utf8")
}
