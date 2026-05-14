/**
 * Shared fetch utility with timeout, retry, response size limiting, and audit logging.
 */

const MAX_RESPONSE_SIZE = 5 * 1024 * 1024 // 5MB
const MAX_JSON_SIZE = 1 * 1024 * 1024 // 1MB
const DEFAULT_TIMEOUT = 30000
const DEFAULT_RETRYABLE_STATUSES = [429, 500, 502, 503, 504]
const RETRY_DELAYS = [1000, 2000]
const SENSITIVE_PARAM_PATTERN = /key|token|secret|password|credential|auth/i

/** 对 URL query 参数中的敏感值脱敏 */
export function maskUrl(raw: string): string {
  try {
    const u = new URL(raw)
    u.searchParams.forEach((_, key) => {
      if (SENSITIVE_PARAM_PATTERN.test(key)) {
        u.searchParams.set(key, "***")
      }
    })
    return u.toString()
  } catch {
    return raw
  }
}

export interface FetchWithRetryConfig {
  timeout?: number
  maxRetries?: number
  retryableStatuses?: number[]
  /** If false, don't retry (e.g. non-GET REST requests) */
  allowRetry?: boolean
}

export interface FetchWithRetryResult {
  response?: Response
  data?: unknown
  error?: string
  metadata?: { truncated?: boolean }
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms))
}

export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  config?: FetchWithRetryConfig,
): Promise<FetchWithRetryResult> {
  const cfg = config ?? {}
  const timeout = cfg.timeout ?? DEFAULT_TIMEOUT
  const maxRetries = cfg.maxRetries ?? 2
  const retryableStatuses = cfg.retryableStatuses ?? DEFAULT_RETRYABLE_STATUSES
  const allowRetry = cfg.allowRetry !== false
  const method = (options.method || "GET").toUpperCase()

  let lastError: string = ""

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const start = Date.now()
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(timeout),
      })

      const duration = Date.now() - start
      console.log(`[datasource] ${method} ${maskUrl(url)} → ${response.status} (${duration}ms)`)

      // Check if retryable
      if (
        !response.ok &&
        allowRetry &&
        retryableStatuses.includes(response.status) &&
        attempt < maxRetries
      ) {
        lastError = `HTTP ${response.status} ${response.statusText}`
        await sleep(RETRY_DELAYS[attempt])
        continue
      }

      if (!response.ok) {
        return { response, error: `HTTP ${response.status} ${response.statusText}` }
      }

      // Check Content-Length
      const contentLength = response.headers.get("content-length")
      if (contentLength && parseInt(contentLength) > MAX_RESPONSE_SIZE) {
        return { error: "响应体过大 (超过 5MB 限制)" }
      }

      // Parse JSON
      const text = await response.text()
      if (text.length > MAX_RESPONSE_SIZE) {
        return { error: "响应体过大 (超过 5MB 限制)" }
      }

      let data: unknown
      try {
        data = JSON.parse(text)
      } catch {
        return { error: `JSON 解析失败: ${text.slice(0, 100)}` }
      }

      let truncated = false
      const jsonStr = JSON.stringify(data)
      if (jsonStr.length > MAX_JSON_SIZE) {
        // Truncate by re-parsing a slice (best effort)
        try {
          data = JSON.parse(jsonStr.slice(0, MAX_JSON_SIZE))
        } catch {
          // If truncated JSON is invalid, just keep original but flag it
        }
        truncated = true
      }

      return { response, data, metadata: { truncated } }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)

      // Timeout detection
      if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
        const timeoutSec = Math.round(timeout / 1000)
        console.log(`[datasource] ${method} ${maskUrl(url)} → ERROR: 请求超时 (${timeoutSec}s)`)
        return { error: `请求超时 (${timeoutSec}s)` }
      }

      console.log(`[datasource] ${method} ${maskUrl(url)} → ERROR: ${message}`)

      // Network error - retry if allowed
      if (allowRetry && attempt < maxRetries) {
        lastError = message
        await sleep(RETRY_DELAYS[attempt])
        continue
      }

      return { error: message }
    }
  }

  return { error: lastError }
}
