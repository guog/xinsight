import type { DatasourceAdapter, DatasourceConfig, DatasourceResult, AuthConfig } from "../types"

/** gRPC 数据源适配器（通过 gRPC-Web/JSON 网关代理） */
export class GrpcAdapter implements DatasourceAdapter {
  readonly type = "grpc" as const

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
      service,
      method,
      message,
      headers: extraHeaders,
    } = params as {
      service?: string
      method?: string
      message?: unknown
      headers?: Record<string, string>
    }

    // 优先使用 endpoint 的协议专属字段
    const resolvedService = (endpoint?.service as string) ?? service
    const resolvedMethod = (endpoint?.method as string) ?? method

    try {
      const grpcConfig = config.config as {
        address: string
        defaultHeaders?: Record<string, string>
        timeout?: number
      }

      const reqHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        ...grpcConfig.defaultHeaders,
        ...this.buildAuthHeaders(config.auth),
        ...extraHeaders,
      }

      const requestTimeout = grpcConfig.timeout ?? 30000

      const response = await fetch(grpcConfig.address, {
        method: "POST",
        headers: reqHeaders,
        body: JSON.stringify({ service: resolvedService, method: resolvedMethod, message }),
        signal: AbortSignal.timeout(requestTimeout),
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
      const grpcConfig = config.config as { address: string }
      await fetch(grpcConfig.address, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
        signal: AbortSignal.timeout(10000),
      })
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
