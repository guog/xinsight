/**
 * Session cookie HMAC 签名与验证
 * 在 Edge Runtime 中可用（仅依赖 Web Crypto API）
 */

const ALGORITHM = { name: "HMAC", hash: "SHA-256" }
const encoder = new TextEncoder()

/** 获取签名密钥（从环境变量） */
function getSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (!secret) {
    throw new Error("SESSION_SECRET 环境变量未设置")
  }
  return secret
}

/** 导入 HMAC 密钥 */
async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", encoder.encode(secret), ALGORITHM, false, [
    "sign",
    "verify",
  ])
}

/** 将 ArrayBuffer 转为 hex 字符串 */
function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

/**
 * 对 sessionId 生成签名，返回 `sessionId.signature` 格式
 */
export async function signSessionId(sessionId: string): Promise<string> {
  const secret = getSecret()
  const key = await importKey(secret)
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(sessionId))
  return `${sessionId}.${bufToHex(signature)}`
}

/**
 * 验证签名 cookie 值，返回原始 sessionId 或 null（无效）
 */
export async function verifySessionCookie(cookieValue: string): Promise<string | null> {
  const dotIndex = cookieValue.lastIndexOf(".")
  if (dotIndex === -1) return null

  const sessionId = cookieValue.slice(0, dotIndex)
  const signature = cookieValue.slice(dotIndex + 1)

  if (!sessionId || !signature) return null

  // 验证 hex 格式（SHA-256 = 64 hex chars）
  if (!/^[0-9a-f]{64}$/.test(signature)) return null

  const secret = getSecret()
  const key = await importKey(secret)
  const expected = await crypto.subtle.sign("HMAC", key, encoder.encode(sessionId))
  const expectedHex = bufToHex(expected)

  // 常量时间比较
  if (expectedHex.length !== signature.length) return null
  let mismatch = 0
  for (let i = 0; i < expectedHex.length; i++) {
    mismatch |= expectedHex.charCodeAt(i) ^ signature.charCodeAt(i)
  }

  return mismatch === 0 ? sessionId : null
}
