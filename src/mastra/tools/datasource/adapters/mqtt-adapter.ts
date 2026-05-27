import type {
  DatasourceAdapter,
  DatasourceConfig,
  DatasourceResult,
  AuthConfig,
  StructuredParam,
} from "../types"
import { whitelistFilterParams } from "../validate-params"

/** MQTT 数据源适配器（通过 HTTP 桥接代理） */
export class MqttAdapter implements DatasourceAdapter {
  readonly type = "mqtt" as const

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

    let filteredParams = params
    if (endpoint && (endpoint.structuredParams as any)?.length > 0) {
      filteredParams = whitelistFilterParams(params, endpoint.structuredParams as StructuredParam[])
    }

    const { payload, timeout } = filteredParams as {
      payload?: unknown
      timeout?: number
    }

    // 从 endpoint 获取默认值，params 可覆盖
    const endpointTopic = endpoint?.topic as string | undefined
    const endpointDirection = endpoint?.direction as string | undefined
    const endpointQos = endpoint?.qos as number | undefined

    // action: 优先 params.action，其次根据 endpoint.direction 映射
    const paramAction = filteredParams.action as string | undefined
    const resolvedAction =
      paramAction ??
      (endpointDirection === "subscribe"
        ? "subscribe_once"
        : endpointDirection === "publish"
          ? "publish"
          : endpointDirection === "both"
            ? "publish"
            : undefined)

    try {
      const mqttConfig = config.config as {
        brokerUrl: string
        defaultTopic?: string
        defaultHeaders?: Record<string, string>
        timeout?: number
      }

      // topic 优先级: params.topic > endpoint.topic > config.defaultTopic
      const resolvedTopic =
        (filteredParams.topic as string) ?? endpointTopic ?? mqttConfig.defaultTopic

      const reqHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        ...mqttConfig.defaultHeaders,
        ...this.buildAuthHeaders(config.auth),
      }

      const body: Record<string, unknown> = { action: resolvedAction, topic: resolvedTopic }
      if (resolvedAction === "publish") body.payload = payload
      if (resolvedAction === "subscribe_once") body.timeout = timeout ?? mqttConfig.timeout
      if (endpointQos != null) body.qos = endpointQos

      const requestTimeout = timeout ?? mqttConfig.timeout ?? 30000

      const response = await fetch(mqttConfig.brokerUrl, {
        method: "POST",
        headers: reqHeaders,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(requestTimeout),
      })

      const duration = Date.now() - start
      const metadata = { duration, datasourceId: config.id, datasourceName: config.name }

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status} ${response.statusText}`, metadata }
      }

      if (resolvedAction === "publish") {
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
        signal: AbortSignal.timeout(10000),
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
