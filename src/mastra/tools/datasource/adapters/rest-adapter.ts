import type { DatasourceAdapter, DatasourceConfig, DatasourceResult, AuthConfig } from "../types"
import { fetchWithRetry } from "./fetch-with-retry"

/** REST 数据源适配器 */
export class RestAdapter implements DatasourceAdapter {
  readonly type = "rest" as const

  async query(
    config: DatasourceConfig,
    params: Record<string, unknown>,
  ): Promise<DatasourceResult> {
    const start = Date.now()

    // 查找 endpoint 定义（如有 endpointId）
    const endpoint = params.endpointId
      ? (config.endpoints.find((ep) => ep.id === params.endpointId) as
          | Record<string, unknown>
          | undefined)
      : undefined

    const {
      path = "",
      method = "GET",
      body,
      headers: extraHeaders,
      query,
    } = params as {
      path?: string
      method?: string
      body?: unknown
      headers?: Record<string, string>
      query?: Record<string, string>
    }

    // 优先使用 endpoint 的协议专属字段
    const resolvedMethod = (endpoint?.method as string) ?? method
    let resolvedPath = (endpoint?.path as string) ?? path

    // 替换路径中的 {param} 占位符
    resolvedPath = resolvedPath.replace(/\{(\w+)\}/g, (_, key) => {
      return String(params[key] ?? `{${key}}`)
    })

    // 合并 endpoint.headers
    const endpointHeaders = (endpoint?.headers as Record<string, string>) ?? {}

    try {
      const restConfig = config.config as {
        baseUrl: string
        defaultHeaders?: Record<string, string>
        timeout?: number
      }
      let url = `${restConfig.baseUrl}${resolvedPath}`

      // 构建 query 参数：endpoint.queryParams 为底，params.query 覆盖
      const searchParams = new URLSearchParams()
      const endpointQueryParams = (endpoint?.queryParams as Record<string, string>) ?? {}
      for (const [k, v] of Object.entries(endpointQueryParams)) searchParams.set(k, v)
      if (query) {
        for (const [k, v] of Object.entries(query)) searchParams.set(k, v)
      }

      // API Key 放入 query
      if (config.auth.type === "apikey" && config.auth.in === "query") {
        searchParams.set(config.auth.key, config.auth.value)
      }

      const qs = searchParams.toString()
      if (qs) url += `?${qs}`

      // 构建请求头
      const reqHeaders: Record<string, string> = {
        ...restConfig.defaultHeaders,
        ...endpointHeaders,
        ...this.buildAuthHeaders(config.auth),
        ...extraHeaders,
      }

      if (body) {
        reqHeaders["Content-Type"] ??= "application/json"
      }

      const timeout = restConfig.timeout ?? 30000
      const isGet = (resolvedMethod as string).toUpperCase() === "GET"

      const result = await fetchWithRetry(
        url,
        {
          method: resolvedMethod as string,
          headers: reqHeaders,
          body: body ? JSON.stringify(body) : undefined,
        },
        {
          timeout,
          allowRetry: isGet,
        },
      )

      const duration = Date.now() - start
      const metadata: Record<string, unknown> = {
        duration,
        datasourceId: config.id,
        datasourceName: config.name,
      }

      if (result.error) {
        const statusCode = result.response?.status
        const diagnosis = statusCode
          ? this.diagnoseStatus(statusCode)
          : this.diagnoseError(result.error)
        metadata.statusCode = statusCode
        metadata.diagnosis = diagnosis
        return {
          success: false,
          error: result.error,
          metadata: metadata as DatasourceResult["metadata"],
        }
      }

      if (result.metadata?.truncated) metadata.truncated = true
      return { success: true, data: result.data, metadata }
    } catch (err) {
      const duration = Date.now() - start
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        metadata: { duration, datasourceId: config.id, datasourceName: config.name },
      }
    }
  }

  async testConnection(
    config: DatasourceConfig,
  ): Promise<{
    ok: boolean
    message: string
    statusCode?: number
    latency?: number
    responsePreview?: string
    diagnosis?: string
  }> {
    const start = Date.now()
    try {
      const restConfig = config.config as { baseUrl: string; timeout?: number }
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), restConfig.timeout ?? 10000)

      const res = await fetch(restConfig.baseUrl, {
        method: "GET",
        signal: controller.signal,
        headers: this.buildAuthHeaders(config.auth),
      })
      clearTimeout(timeout)

      const latency = Date.now() - start
      const statusCode = res.status
      let responsePreview = ""
      try {
        const text = await res.text()
        responsePreview = text.slice(0, 500)
      } catch {}

      const diagnosis = this.diagnoseStatus(statusCode)

      if (res.ok) {
        return {
          ok: true,
          message: `连接成功 (${statusCode})`,
          statusCode,
          latency,
          responsePreview,
        }
      }
      return {
        ok: false,
        message: `HTTP ${statusCode}`,
        statusCode,
        latency,
        responsePreview,
        diagnosis,
      }
    } catch (err) {
      const latency = Date.now() - start
      const message = err instanceof Error ? err.message : String(err)
      return { ok: false, message, latency, diagnosis: this.diagnoseError(message) }
    }
  }

  private diagnoseStatus(status: number): string {
    if (status === 401) return "认证失败，请检查 Token 或 API Key 是否正确"
    if (status === 403) return "无权访问，请检查账号权限"
    if (status === 404) return "API 地址不存在，请检查 Base URL 是否正确"
    if (status === 500) return "服务器内部错误，请联系数据源管理员"
    if (status === 502 || status === 503) return "服务不可用，可能正在维护中"
    if (status === 429) return "请求频率过高，请稍后重试"
    return ""
  }

  private diagnoseError(message: string): string {
    if (message.includes("ECONNREFUSED")) return "无法连接服务器，请确认地址和端口是否正确"
    if (message.includes("ENOTFOUND")) return "域名解析失败，请检查 URL 是否拼写正确"
    if (message.includes("ETIMEDOUT") || message.includes("timeout") || message.includes("abort"))
      return "连接超时，请检查网络或增大超时时间"
    if (message.includes("CERT") || message.includes("SSL"))
      return "SSL 证书错误，请检查 HTTPS 配置"
    return "未知错误，请检查网络连接"
  }

  /** 根据认证配置生成请求头 */
  private buildAuthHeaders(auth: AuthConfig): Record<string, string> {
    switch (auth.type) {
      case "bearer":
        return { Authorization: `Bearer ${auth.token}` }
      case "basic":
        return { Authorization: `Basic ${btoa(`${auth.username}:${auth.password}`)}` }
      case "apikey":
        return auth.in === "header" ? { [auth.key]: auth.value } : {}
      case "none":
      default:
        return {}
    }
  }
}
