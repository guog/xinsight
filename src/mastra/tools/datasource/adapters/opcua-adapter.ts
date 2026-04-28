import type { DatasourceAdapter, DatasourceConfig, DatasourceResult, AuthConfig } from "../types"

/** OPC UA 数据源适配器（通过 REST 网关代理） */
export class OpcuaAdapter implements DatasourceAdapter {
  readonly type = "opcua" as const

  async query(
    config: DatasourceConfig,
    params: Record<string, unknown>,
  ): Promise<DatasourceResult> {
    const start = Date.now()
    const { action, nodeIds, nodeId, values } = params as {
      action: "read" | "write" | "browse"
      nodeIds?: string[]
      nodeId?: string
      values?: unknown[]
    }

    try {
      const opcuaConfig = config.config as {
        endpointUrl: string
        defaultHeaders?: Record<string, string>
        timeout?: number
      }

      // 构建请求体
      let body: Record<string, unknown>
      if (action === "read") {
        body = { action: "read", nodeIds }
      } else if (action === "write") {
        body = { action: "write", nodeIds, values }
      } else {
        body = { action: "browse", nodeId }
      }

      const reqHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        ...opcuaConfig.defaultHeaders,
        ...this.buildAuthHeaders(config.auth),
      }

      const response = await fetch(opcuaConfig.endpointUrl, {
        method: "POST",
        headers: reqHeaders,
        body: JSON.stringify(body),
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
      const opcuaConfig = config.config as {
        endpointUrl: string
        defaultHeaders?: Record<string, string>
      }
      const reqHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        ...opcuaConfig.defaultHeaders,
        ...this.buildAuthHeaders(config.auth),
      }

      const response = await fetch(opcuaConfig.endpointUrl, {
        method: "POST",
        headers: reqHeaders,
        body: JSON.stringify({ action: "browse", nodeId: "i=84" }),
      })

      if (!response.ok) {
        return { ok: false, message: `HTTP ${response.status} ${response.statusText}` }
      }

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
