/** 判断错误是否为可重试类型（速率限制、超时、网络错误） */
export function isRetryableError(e: unknown): boolean {
  if (!e) return false
  const message = e instanceof Error ? e.message.toLowerCase() : String(e).toLowerCase()
  // HTTP 429 / 速率限制
  if (
    message.includes("429") ||
    message.includes("rate limit") ||
    message.includes("too many requests")
  )
    return true
  // 超时
  if (message.includes("timeout") || message.includes("timed out") || message.includes("etimedout"))
    return true
  // 网络错误
  if (
    message.includes("econnreset") ||
    message.includes("econnrefused") ||
    message.includes("fetch failed") ||
    message.includes("network")
  )
    return true
  // 503 服务不可用
  if (message.includes("503") || message.includes("service unavailable")) return true
  // 检查 status 属性
  const status =
    (e as Record<string, unknown>)?.status ?? (e as Record<string, unknown>)?.statusCode
  if (status === 429 || status === 503 || status === 502) return true
  return false
}
