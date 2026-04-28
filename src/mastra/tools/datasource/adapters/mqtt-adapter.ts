import type { DatasourceAdapter, DatasourceConfig, DatasourceResult, AuthConfig } from "../types"

/** MQTT 数据源适配器（通过 HTTP 桥接代理） */
export class MqttAdapter implements DatasourceAdapter {
  readonly type = "mqtt" as const

  async query(
    config: DatasourceConfig,
    params: Record<string, unknown>,
  ): Promise<DatasourceResult> {
    const start = Date.now()
    const { action, topic, payload, timeout } = params as {
      action: "publish" | "subscribe_once"
      topic?: string
      payload?: unknown
      timeout?: number
    }

    try {
      const mqttConfig = config.config as {
        brokerUrl: string
        defaultTopic?: string
        defaultHeaders?: Record<string, string>
        timeout?: number
      }

      const resolvedTopic = topic ?? mqttConfig.defaultTopic

      const reqHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        ...mqttConfig.defaultHeaders,
        ...this.buildAuthHeaders(config.auth),
      }

      const body: Record<string, unknown> = { action, topic: resolvedTopic }
      if (action === "publish") body.payload = payload
      if (action === "subscribe_once") body.timeout = timeout ?? mqttConfig.timeout

      const response = await fetch(mqttConfig.brokerUrl, {
        method: "POST",
        headers: reqHeaders,
        body: JSON.stringify(body),
      })

      const duration = Date.now() - start
      const metadata = { duration, datasourceId: config.id, datasourceName: config.name }

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status} ${response.statusText}`, metadata }
      }

      if (action === "publish") {
        return { success: true, data: { published: true }, metadata }
      }

      // subscribe_once: 返回响应数据
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
      const mqttConfig = config.config as { brokerUrl: string }
      const reqHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        ...this.buildAuthHeaders(config.auth),
      }

      const response = await fetch(mqttConfig.brokerUrl, {
        method: "POST",
        headers: reqHeaders,
        body: JSON.stringify({
          action: "subscribe_once",
          topic: "$SYS/broker/version",
          timeout: 5000,
        }),
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
