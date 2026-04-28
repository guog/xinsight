import type { DatasourceAdapter, DatasourceConfig, DatasourceResult } from "../types"

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
    const endpoint = config.config.endpoint as string
    const body: Record<string, unknown> = { query: params.query }
    if (params.variables) body.variables = params.variables
    if (params.operationName) body.operationName = params.operationName

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: this.buildHeaders(config),
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        return { success: false, error: `HTTP ${res.status}: ${res.statusText}` }
      }

      const json = await res.json()

      if (json.errors?.length) {
        return {
          success: false,
          error: json.errors.map((e: { message: string }) => e.message).join("; "),
        }
      }

      return { success: true, data: json.data }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  }

  async testConnection(config: DatasourceConfig): Promise<{ ok: boolean; message: string }> {
    const result = await this.query(config, { query: "{ __typename }" })
    return {
      ok: result.success,
      message: result.success ? "连接成功" : (result.error ?? "未知错误"),
    }
  }
}
