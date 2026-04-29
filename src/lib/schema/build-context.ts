import { db } from "@/db"
import { datasources, agentDatasources } from "@/db/schema"
import { eq } from "drizzle-orm"

export interface EndpointParam {
  name: string
  type?: string
}

export interface ResponseField {
  name: string
  type?: string
  description?: string
}

export interface EndpointConfig {
  id?: string
  name: string
  description?: string
  method?: string
  path?: string
  params?: EndpointParam[]
  responseSchema?: ResponseField[]
}

export interface DatasourceConfig {
  name: string
  type: string
  description?: string | null
  endpoints?: EndpointConfig[] | null
}

const MAX_LENGTH = 2000
const TRUNCATION_MARKER = "...更多端点省略"

export function formatDatasourceContext(sources: DatasourceConfig[]): string {
  if (!sources.length) return ""

  let result = ""

  for (const ds of sources) {
    const header = `【${ds.name}】(${ds.type})${ds.description ? ` - ${ds.description}` : ""}\n`

    if (result.length + header.length > MAX_LENGTH) {
      result += TRUNCATION_MARKER
      break
    }
    result += header

    if (!ds.endpoints?.length) continue

    for (const ep of ds.endpoints) {
      const method = ep.method?.toUpperCase() || "GET"
      const path = ep.path || ""
      let line = `  端点: ${method} ${path}${ep.description ? ` - ${ep.description}` : ""}\n`

      if (ep.params?.length) {
        const paramStr = ep.params.map((p) => `${p.name}(${p.type || "string"})`).join(", ")
        line += `    参数: ${paramStr}\n`
      }

      if (ep.responseSchema?.length) {
        const fieldStr = ep.responseSchema
          .map((f) => `${f.name}(${f.type || "any"}${f.description ? ":" + f.description : ""})`)
          .join(", ")
        line += `    返回: ${fieldStr}\n`
      }

      if (result.length + line.length > MAX_LENGTH) {
        result += `  ${TRUNCATION_MARKER}\n`
        break
      }
      result += line
    }

    if (result.length >= MAX_LENGTH) break
  }

  return result.length > MAX_LENGTH
    ? result.slice(0, MAX_LENGTH - TRUNCATION_MARKER.length) + TRUNCATION_MARKER
    : result
}

export async function buildDatasourceContext(agentId: string): Promise<string> {
  try {
    const rows = await db
      .select({
        name: datasources.name,
        type: datasources.type,
        description: datasources.description,
        endpoints: datasources.endpoints,
      })
      .from(agentDatasources)
      .innerJoin(datasources, eq(agentDatasources.datasourceId, datasources.id))
      .where(eq(agentDatasources.agentId, agentId))

    const enabled = rows.filter((r) => r.name) as DatasourceConfig[]
    return formatDatasourceContext(enabled)
  } catch {
    // 降级处理：DB 查询失败时不影响对话
    return ""
  }
}
