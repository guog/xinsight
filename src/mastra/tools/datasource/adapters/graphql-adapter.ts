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

  async testConnection(config: DatasourceConfig): Promise<{ ok: boolean; message: string }> {
    const result = await this.query(config, { query: "{ __typename }" })
    return {
      ok: result.success,
      message: result.success ? "连接成功" : (result.error ?? "未知错误"),
    }
  }
}
