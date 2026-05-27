import { createTool } from "@mastra/core/tools"
import { z } from "zod"
import { db } from "@/db"
import { SqliteDatasourceRepository } from "@/db/repositories/datasource-repository"
import { getAdapter } from "./adapters"
import type { DatasourceConfig } from "./types"
import type { StructuredParam } from "./types"
import {
  validateParams,
  formatParamHints,
  safeFilterParams,
  isWriteEndpoint,
} from "./validate-params"

const MAX_TOOLS = 20

function structuredParamsToZod(params: StructuredParam[]) {
  const shape: Record<string, z.ZodTypeAny> = {}
  for (const p of params) {
    let field: z.ZodTypeAny
    switch (p.type) {
      case "number":
        field = z.number()
        break
      case "boolean":
        field = z.boolean()
        break
      default:
        field = z.string()
    }
    if (p.description) field = field.describe(p.description)
    if (!p.required) field = field.optional()
    shape[p.name] = field
  }
  return z.object(shape)
}

export async function buildDynamicTools(agentId: string) {
  const repo = new SqliteDatasourceRepository(db)
  const [datasources, bindings] = await Promise.all([
    repo.findByAgentId(agentId),
    repo.getAgentEndpointBindings(agentId),
  ])

  if (!datasources.length) return {}

  const bindingMap = new Map(
    bindings.map((b) => [
      b.datasourceId,
      {
        endpointIds: b.endpointIds,
        confirmationRequiredEndpoints: b.confirmationRequiredEndpoints,
      },
    ]),
  )
  const tools: Record<string, ReturnType<typeof createTool>> = {}
  let count = 0

  for (const ds of datasources) {
    const binding = bindingMap.get(ds.id)
    const allowedEps = binding?.endpointIds

    let confirmationRequiredList: string[] = []
    if (binding?.confirmationRequiredEndpoints) {
      try {
        confirmationRequiredList =
          typeof binding.confirmationRequiredEndpoints === "string"
            ? JSON.parse(binding.confirmationRequiredEndpoints)
            : binding.confirmationRequiredEndpoints
      } catch {}
    }

    for (const ep of ds.endpoints ?? []) {
      if (count >= MAX_TOOLS) break
      // null = 全部允许，[] = 全部禁止，[...ids] = 仅允许指定端点
      if (allowedEps !== undefined && allowedEps !== null && !allowedEps.includes(ep.id)) continue

      const toolId = `${ds.id}--${ep.id}`
      const sParams = (ep as Record<string, unknown>).structuredParams as
        | StructuredParam[]
        | undefined
      const hasStructured = sParams && sParams.length > 0

      const isWrite = isWriteEndpoint(ep)
      const isConfRequired = isWrite && confirmationRequiredList.includes(ep.id)
      const displayMethod =
        (ep as any).method ||
        (ep as any).action ||
        (ep as any).operationType ||
        (ep as any).direction ||
        "WRITE"

      const inputSchema = hasStructured
        ? z.object({ params: structuredParamsToZod(sParams).optional() })
        : z.object({ params: z.record(z.string(), z.unknown()).optional() })

      tools[toolId] = createTool({
        id: toolId,
        description: `[${ds.name}] ${ep.name}：${ep.description}`,
        inputSchema,
        outputSchema: z.object({
          success: z.boolean(),
          data: z.unknown().optional(),
          error: z.string().optional(),
          metadata: z.record(z.string(), z.unknown()).optional(),
        }),
        execute: async (input) => {
          const adapter = getAdapter(ds.type)
          if (!adapter) return { success: false, error: `不支持的数据源类型: ${ds.type}` }

          const mergedParams = { ...ep.params, ...safeFilterParams(input.params) }

          if (isConfRequired) {
            return {
              success: false,
              error: "CONFIRMATION_REQUIRED",
              metadata: {
                confirmationRequired: true,
                agentId,
                datasourceId: ds.id,
                datasourceName: ds.name,
                endpointId: ep.id,
                endpointName: ep.name,
                method: displayMethod,
                params: mergedParams,
              },
            }
          }

          if (hasStructured) {
            const validation = validateParams(sParams, mergedParams)
            if (!validation.valid) {
              return {
                success: false,
                error: `参数校验失败:\n${validation.errors.join("\n")}`,
                metadata: { paramHints: formatParamHints(sParams) },
              }
            }
          }

          return adapter.query(
            {
              id: ds.id,
              name: ds.name,
              type: ds.type as DatasourceConfig["type"],
              auth: ds.auth as DatasourceConfig["auth"],
              config: ds.config,
              endpoints: ds.endpoints,
              enabled: ds.enabled,
              createdAt: ds.createdAt,
              updatedAt: ds.updatedAt,
            },
            mergedParams,
          )
        },
      })
      count++
    }
    if (count >= MAX_TOOLS) break
  }

  return tools
}
