/** 脱敏工具：隐藏敏感字段值 */

const SENSITIVE_KEYS = ["password", "api_key", "apiKey", "secret", "token", "authorization"]

/** 对对象中的敏感字段进行脱敏 */
export function maskSensitiveFields<T extends Record<string, unknown>>(obj: T): T {
  const result = { ...obj }

  // 脱敏 auth 字段（JSON 字符串或对象）
  if ("auth" in result && result.auth) {
    if (typeof result.auth === "string") {
      try {
        const parsed = JSON.parse(result.auth)
        result.auth = JSON.stringify(maskObject(parsed)) as T["auth"]
      } catch {
        result.auth = "***" as T["auth"]
      }
    } else if (typeof result.auth === "object") {
      result.auth = maskObject(result.auth as Record<string, unknown>) as T["auth"]
    }
  }

  // 脱敏 apiKey 字段
  if ("apiKey" in result && result.apiKey) {
    result.apiKey = maskString(String(result.apiKey)) as T["apiKey"]
  }
  if ("api_key" in result && result.api_key) {
    result.api_key = maskString(String(result.api_key)) as T["api_key"]
  }

  return result
}

/** 对字符串值进行部分脱敏，保留前后各 2 字符 */
export function maskString(value: string): string {
  if (value.length <= 8) return "***"
  return value.slice(0, 2) + "***" + value.slice(-2)
}

function maskObject(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.some((k) => key.toLowerCase().includes(k.toLowerCase()))) {
      result[key] = typeof value === "string" ? maskString(value) : "***"
    } else {
      result[key] = value
    }
  }
  return result
}
