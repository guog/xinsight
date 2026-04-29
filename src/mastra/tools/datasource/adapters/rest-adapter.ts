import type { DatasourceAdapter, DatasourceConfig, DatasourceResult, AuthConfig } from "../types"

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

      const response = await fetch(url, {
        method: resolvedMethod as string,
        headers: reqHeaders,
        body: body ? JSON.stringify(body) : undefined,
      })

      const duration = Date.now() - start
      const metadata = { duration, datasourceId: config.id, datasourceName: config.name }

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status} ${response.statusText}`, metadata }
      }

      const data = await response.json()
      return { success: true, data, metadata }
    } catch (err) {
      const duration = Date.now() - start
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        metadata: { duration, datasourceId: config.id, datasourceName: config.name },
      }
    }
  }

  async testConnection(config: DatasourceConfig): Promise<{ ok: boolean; message: string }> {
    try {
      const restConfig = config.config as { baseUrl: string }
      await fetch(restConfig.baseUrl, { method: "HEAD" })
      return { ok: true, message: "连接成功" }
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) }
    }
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
