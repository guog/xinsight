import { db } from "@/db"
import { workflows, workflowExecutions, datasources, agentDatasources } from "@/db/schema"
import { and, eq, inArray } from "drizzle-orm"
import { Workflow, createStep } from "@mastra/core/workflows"
import { mastra } from "@/mastra"
import { getAdapter } from "@/mastra/tools/datasource/adapters"
import type { DatasourceConfig } from "@/mastra/tools/datasource/types"
import { z } from "zod"
import { SqliteAgentRepository } from "@/db/repositories/agent-repository"
import { safeFilterParams, isWriteEndpoint } from "@/mastra/tools/datasource/validate-params"
import { topologicalSort } from "./topo-sort"

// 递归模板参数替换辅助函数
function resolveTemplate(
  template: string,
  inputData: any,
  getStepResult: (id: string) => any,
): string {
  if (typeof template !== "string") return template
  return template.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
    const parts = path.trim().split(".")
    const source = parts[0]
    if (source === "input") {
      return getNestedValue(inputData, parts.slice(1))
    } else {
      const stepResult = getStepResult(source)
      if (!stepResult) return ""

      // 如果路径的第二部分是 "output"，则我们略过它直接匹配属性，以支持 {{nodeId.output.property}} 这种通用可视化语法
      const remainingPath = parts[1] === "output" ? parts.slice(2) : parts.slice(1)

      // 提取输出，检查是否存在 output/result 包装，若无则使用直接输出
      const output = stepResult.output || stepResult.result || stepResult
      return getNestedValue(output, remainingPath)
    }
  })
}

function getNestedValue(obj: any, path: string[]): string {
  let curr = obj
  for (const key of path) {
    if (curr === null || curr === undefined) return ""
    curr = curr[key]
  }
  return curr !== undefined ? String(curr) : ""
}

function getNestedValueRaw(obj: any, path: string[]): any {
  let curr = obj
  for (const key of path) {
    if (curr === null || curr === undefined) return undefined
    curr = curr[key]
  }
  return curr
}

function resolveSinglePlaceholder(
  template: string,
  inputData: any,
  getStepResult: (id: string) => any,
): { matched: boolean; value: any } {
  if (typeof template !== "string") return { matched: false, value: null }
  const match = template.match(/^\{\{([^}]+)\}\}$/)
  if (!match) return { matched: false, value: null }

  const path = match[1].trim()
  const parts = path.split(".")
  const source = parts[0]
  let result: any
  if (source === "input") {
    result = getNestedValueRaw(inputData, parts.slice(1))
  } else {
    const stepResult = getStepResult(source)
    if (!stepResult) return { matched: true, value: undefined }

    const remainingPath = parts[1] === "output" ? parts.slice(2) : parts.slice(1)
    const output = stepResult.output || stepResult.result || stepResult
    result = getNestedValueRaw(output, remainingPath)
  }
  return { matched: true, value: result }
}

function resolveParams(params: any, inputData: any, getStepResult: (id: string) => any): any {
  if (typeof params === "string") {
    const single = resolveSinglePlaceholder(params, inputData, getStepResult)
    if (single.matched) {
      return single.value
    }
    return resolveTemplate(params, inputData, getStepResult)
  }
  if (Array.isArray(params)) {
    return params.map((item) => resolveParams(item, inputData, getStepResult))
  }
  if (params && typeof params === "object") {
    const res: any = {}
    for (const [k, v] of Object.entries(params)) {
      res[k] = resolveParams(v, inputData, getStepResult)
    }
    return res
  }
  return params
}

import type { WorkflowNode, WorkflowEdge, WorkflowDefinition } from "./topo-sort"

const WorkflowDefinitionSchema = z.object({
  nodes: z.array(
    z.object({
      id: z.string(),
      type: z.enum(["agent", "tool"]),
      config: z.object({
        agentId: z.string().optional(),
        prompt: z.string().optional(),
        datasourceId: z.string().optional(),
        endpointId: z.string().optional(),
        params: z.record(z.string(), z.unknown()).optional(),
      }),
    }),
  ),
  edges: z.array(
    z.object({
      source: z.string(),
      target: z.string(),
    }),
  ),
})

/**
 * xinsight 可视化工作流动态构建与执行引擎
 */
export class WorkflowEngine {
  /**
   * 动态执行工作流，并实时持久化每一步的运行日志 Trace 到 SQLite 数据库
   */
  static async execute(
    workflowId: string,
    inputData: Record<string, any>,
    context?: { userId?: string; role?: string },
  ): Promise<any> {
    const wfRecord = db.select().from(workflows).where(eq(workflows.id, workflowId)).get()
    if (!wfRecord) {
      throw new Error(`工作流定义未找到: ${workflowId}`)
    }

    let definition: WorkflowDefinition
    try {
      const rawDef = JSON.parse(wfRecord.definition)
      definition = WorkflowDefinitionSchema.parse(rawDef) as unknown as WorkflowDefinition
    } catch (e: any) {
      throw new Error(`工作流定义损坏或格式不正确: ${e.message}`)
    }

    // 1. 拓扑排序计算步骤执行顺序
    const sortedNodes = topologicalSort(definition.nodes, definition.edges)
    if (sortedNodes.length === 0) {
      throw new Error("工作流中没有配置任何有效的步骤节点")
    }

    const executionId = crypto.randomUUID()
    const startedAt = new Date()
    const traceLogs: any[] = []

    // 用于串行化写入日志，防范并发/并行执行时的竞态问题
    let dbUpdatePromise = Promise.resolve()
    const safeUpdateLogs = (newLogs: any[]) => {
      dbUpdatePromise = dbUpdatePromise.then(async () => {
        db.update(workflowExecutions)
          .set({ logs: JSON.stringify(newLogs) })
          .where(eq(workflowExecutions.id, executionId))
          .run()
      })
    }

    // 2. 在数据库中插入初始的 Running 状态记录
    db.insert(workflowExecutions)
      .values({
        id: executionId,
        workflowId,
        status: "running",
        input: JSON.stringify(inputData),
        logs: JSON.stringify(traceLogs),
        startedAt,
      })
      .run()

    try {
      const stepsList: any[] = []

      // 3. 动态将 nodes 转换为 Mastra Workflow Steps
      for (const node of sortedNodes) {
        const step = createStep({
          id: node.id,
          inputSchema: z.any(),
          outputSchema: z.any(),
          execute: async ({ getStepResult }) => {
            const stepStart = Date.now()
            const stepLog: any = {
              nodeId: node.id,
              type: node.type,
              startedAt: new Date().toISOString(),
            }

            try {
              if (node.type === "agent") {
                const agentId = node.config.agentId
                const templatePrompt = node.config.prompt ?? ""
                if (!agentId) throw new Error("Agent 节点缺少必要属性 agentId")

                if (context?.userId && context?.role && context.role !== "admin") {
                  const agentRepo = new SqliteAgentRepository(db)
                  const authorizedAgents = await agentRepo.getAuthorizedAgentsForUser(
                    context.userId,
                    context.role,
                  )
                  if (!authorizedAgents.some((a) => a.id === agentId)) {
                    throw new Error(`权限不足: 当前用户无权在工作流中执行 Agent '${agentId}'`)
                  }
                }

                // 动态解析提示词参数
                const resolvedPrompt = resolveTemplate(templatePrompt, inputData, getStepResult)
                stepLog.input = { prompt: resolvedPrompt }

                const agent = mastra.getAgent(agentId as any)
                if (!agent) throw new Error(`未找到配置的 Agent: ${agentId}`)

                // 运行 Agent generate 方法
                const response = await agent.generate(resolvedPrompt)

                stepLog.output = { text: response.text }
                stepLog.endedAt = new Date().toISOString()
                stepLog.duration = Date.now() - stepStart
                stepLog.status = "success"

                // 实时持久化 Trace 日志
                traceLogs.push(stepLog)
                safeUpdateLogs(traceLogs)

                return { text: response.text }
              } else if (node.type === "tool") {
                const dsId = node.config.datasourceId
                const epId = node.config.endpointId
                const templateParams = node.config.params ?? {}

                if (!dsId || !epId) {
                  throw new Error("Tool 节点必须包含 datasourceId 和 endpointId")
                }

                // 动态解析调用参数
                const resolvedParams = resolveParams(templateParams, inputData, getStepResult)
                stepLog.input = { datasourceId: dsId, endpointId: epId, params: resolvedParams }

                // 查询对应的数据源并调用适配器执行
                const ds = db.select().from(datasources).where(eq(datasources.id, dsId)).get()
                if (!ds) throw new Error(`数据源未找到: ${dsId}`)
                if (!ds.enabled) throw new Error(`数据源已被禁用: ${dsId}`)

                const endpoints =
                  typeof ds.endpoints === "string"
                    ? JSON.parse(ds.endpoints)
                    : (ds.endpoints as any)
                const ep = (endpoints as any[])?.find((e) => e.id === epId)
                if (!ep) throw new Error(`数据源端点未找到: ${epId}`)

                const adapter = getAdapter(ds.type)
                if (!adapter) throw new Error(`不支持的数据源类型: ${ds.type}`)

                // 细粒度越权防护与写操作二次确认拦截
                if (context?.userId && context?.role !== "admin") {
                  const agentRepo = new SqliteAgentRepository(db)
                  const authorizedAgents = await agentRepo.getAuthorizedAgentsForUser(
                    context.userId,
                    context.role,
                  )
                  const authorizedAgentIds = authorizedAgents.map((a) => a.id)
                  if (authorizedAgentIds.length === 0) {
                    throw new Error(`权限不足: 当前用户没有任何可用的 Agent，无权访问数据源`)
                  }

                  // 查询对应的绑定关系
                  const bindings = db
                    .select()
                    .from(agentDatasources)
                    .where(
                      and(
                        inArray(agentDatasources.agentId, authorizedAgentIds),
                        eq(agentDatasources.datasourceId, dsId),
                      ),
                    )
                    .all()

                  if (bindings.length === 0) {
                    throw new Error(`权限不足: 当前用户无权访问数据源 '${ds.name}'`)
                  }

                  // 1. 校验端点白名单权限
                  const hasAccess = bindings.some((b) => {
                    if (!b.endpointIds) return true
                    try {
                      const epIds = JSON.parse(b.endpointIds) as string[]
                      return epIds.includes(epId)
                    } catch {
                      return false
                    }
                  })
                  if (!hasAccess) {
                    throw new Error(
                      `权限不足: 当前用户无权访问数据源 '${ds.name}' 的接口 '${epId}'`,
                    )
                  }

                  // 2. 校验写操作二次确认
                  const isWrite = isWriteEndpoint(ep)
                  if (isWrite) {
                    const isConfRequired = bindings.some((b) => {
                      if (!b.confirmationRequiredEndpoints) return false
                      try {
                        const confRequiredEps =
                          typeof b.confirmationRequiredEndpoints === "string"
                            ? JSON.parse(b.confirmationRequiredEndpoints)
                            : b.confirmationRequiredEndpoints
                        return Array.isArray(confRequiredEps) && confRequiredEps.includes(epId)
                      } catch {
                        return false
                      }
                    })
                    if (isConfRequired) {
                      throw new Error(
                        `权限不足: 接口 '${epId}' 需要二次确认，工作流引擎禁止直接执行写操作`,
                      )
                    }
                  }
                } else if (!context?.userId && context?.role !== "admin") {
                  // 出于安全考虑，如果完全没有 userId 且不是 admin，检测到写操作也应当抛错拦截
                  const isWrite = isWriteEndpoint(ep)
                  if (isWrite) {
                    throw new Error(
                      `安全限制: 未登录或未知上下文，工作流引擎禁止执行写操作 '${epId}'`,
                    )
                  }
                }

                const mergedParams = { ...ep.params, ...safeFilterParams(resolvedParams) }
                const result = await adapter.query(
                  {
                    id: ds.id,
                    name: ds.name,
                    type: ds.type as DatasourceConfig["type"],
                    auth: typeof ds.auth === "string" ? JSON.parse(ds.auth) : ds.auth,
                    config: typeof ds.config === "string" ? JSON.parse(ds.config) : ds.config,
                    endpoints,
                    enabled: ds.enabled,
                  } as any,
                  mergedParams,
                )

                stepLog.output = result
                if (!result.success) {
                  throw new Error(`端点 API 调用失败: ${result.error}`)
                }

                stepLog.endedAt = new Date().toISOString()
                stepLog.duration = Date.now() - stepStart
                stepLog.status = "success"

                traceLogs.push(stepLog)
                safeUpdateLogs(traceLogs)

                return result
              } else {
                throw new Error(`不支持的节点类型: ${node.type}`)
              }
            } catch (err: any) {
              stepLog.status = "failed"
              stepLog.error = err.message
              stepLog.endedAt = new Date().toISOString()
              stepLog.duration = Date.now() - stepStart
              traceLogs.push(stepLog)
              safeUpdateLogs(traceLogs)

              throw err
            }
          },
        })
        stepsList.push(step)
      }

      // 4. 构建并启动 Mastra 工作流执行
      const mastraWf = new Workflow({
        id: `wf-run-${executionId}`,
        inputSchema: z.any(),
        outputSchema: z.any(),
      })
      let currentWf = mastraWf
      for (const step of stepsList) {
        currentWf = currentWf.then(step)
      }
      currentWf.commit()

      const run = await currentWf.createRun()
      const runResult: any = await run.start({ inputData })

      if (runResult.status === "success") {
        db.update(workflowExecutions)
          .set({
            status: "completed",
            output: JSON.stringify(runResult.result ?? {}),
            completedAt: new Date(),
          })
          .where(eq(workflowExecutions.id, executionId))
          .run()
        return runResult.result
      } else {
        // 深入提取具体的失败报错信息进行透传
        let errorMsg = runResult.error?.message
        if (!errorMsg && runResult.steps) {
          for (const stepVal of Object.values(runResult.steps) as any[]) {
            if (stepVal?.status === "failed" && stepVal?.error?.message) {
              errorMsg = stepVal.error.message
              break
            }
          }
        }
        throw new Error(errorMsg || "工作流执行器运行异常，未能成功结束。")
      }
    } catch (error: any) {
      db.update(workflowExecutions)
        .set({
          status: "failed",
          output: JSON.stringify({ error: error.message }),
          completedAt: new Date(),
        })
        .where(eq(workflowExecutions.id, executionId))
        .run()
      throw error
    }
  }
}
