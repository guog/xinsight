import type { DatasourceAdapter, DatasourceConfig, DatasourceResult } from "../types"
import { fetchWithRetry } from "./fetch-with-retry"

/** GraphQL 数据源适配器 */
export class GraphqlAdapter implements DatasourceAdapter {
  readonly type = "graphql" as const

  /** 根据认证配置生成请求头 */
  private buildHeaders(config: DatasourceConfig): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(config.config.defaultHeaders as Record<string, string> | undefined),
    }

    switch (config.auth.type) {
      case "bearer":
        headers["Authorization"] = `Bearer ${config.auth.token}`
        break
      case "basic":
        headers["Authorization"] =
          `Basic ${btoa(`${config.auth.username}:${config.auth.password}`)}`
        break
      case "apikey":
        if (config.auth.in === "header") {
          headers[config.auth.key] = config.auth.value
        }
        break
    }

    return headers
  }

  async query(
    config: DatasourceConfig,
    params: Record<string, unknown>,
  ): Promise<DatasourceResult> {
    const gqlEndpoint = config.config.endpoint as string

    // 查找 endpoint 定义（如有 endpointId）
    const endpoint = params.endpointId
      ? (config.endpoints.find((ep) => ep.id === params.endpointId) as
          | Record<string, unknown>
          | undefined)
      : undefined

    // 优先使用 endpoint 的协议专属字段
    const resolvedQuery = (endpoint?.query as string) ?? params.query
    const resolvedOperationName = (endpoint?.operationName as string) ?? params.operationName
    const resolvedVariables = params.variables

    const body: Record<string, unknown> = { query: resolvedQuery }
    if (resolvedVariables) body.variables = resolvedVariables
    if (resolvedOperationName) body.operationName = resolvedOperationName

    const timeout =
      ((config.config as Record<string, unknown>)?.timeout as number | undefined) ?? 30000

    const result = await fetchWithRetry(
      gqlEndpoint,
      {
        method: "POST",
        headers: this.buildHeaders(config),
        body: JSON.stringify(body),
      },
      {
        timeout,
        allowRetry: true,
      },
    )

    if (result.error) {
      return { success: false, error: result.error }
    }

    const json = result.data as Record<string, unknown>
    if (json?.errors?.length) {
      return {
        success: false,
        error: json.errors.map((e: { message: string }) => e.message).join("; "),
      }
    }

    const metadata: Record<string, unknown> = {}
    if (result.metadata?.truncated) metadata.truncated = true

    return {
      success: true,
      data: json?.data ?? json,
      ...(Object.keys(metadata).length ? { metadata } : {}),
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
      const gqlEndpoint = config.config.endpoint as string
      const controller = new AbortController()
      const timeout =
        ((config.config as Record<string, unknown>)?.timeout as number | undefined) ?? 10000
      const timer = setTimeout(() => controller.abort(), timeout)

      const res = await fetch(gqlEndpoint, {
        method: "POST",
        signal: controller.signal,
        headers: this.buildHeaders(config),
        body: JSON.stringify({ query: "{ __typename }" }),
      })
      clearTimeout(timer)

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
    if (status === 404) return "API 地址不存在，请检查 GraphQL endpoint 是否正确"
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
}
