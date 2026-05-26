import { describe, it, expect, beforeEach, vi } from "vitest"
import { Database } from "bun:sqlite"
import { drizzle } from "drizzle-orm/bun-sqlite"
import { eq } from "drizzle-orm"
import * as schema from "@/db/schema"

// Mock mastra 实例和 agents
const mockGenerate = vi.fn()
vi.mock("@/mastra", () => ({
  mastra: {
    getAgent: () => ({
      generate: mockGenerate,
    }),
  },
}))

// Mock 适配器获取
const mockQuery = vi.fn()
vi.mock("@/mastra/tools/datasource/adapters", () => ({
  getAdapter: () => ({
    query: mockQuery,
  }),
}))

function createTestDb() {
  const sqlite = new Database(":memory:")
  sqlite.exec(`
    CREATE TABLE custom_agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      system_prompt TEXT NOT NULL DEFAULT '',
      model_id TEXT,
      icon TEXT,
      is_builtin INTEGER NOT NULL DEFAULT 0,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE datasources (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL,
      auth TEXT NOT NULL,
      config TEXT NOT NULL,
      endpoints TEXT NOT NULL DEFAULT '[]',
      enabled INTEGER NOT NULL DEFAULT 1,
      last_tested_at INTEGER,
      last_test_result TEXT,
      last_test_message TEXT,
      last_called_at INTEGER,
      call_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE workflows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      definition TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      version INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE workflow_executions (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'running',
      input TEXT NOT NULL,
      output TEXT,
      logs TEXT,
      started_at INTEGER NOT NULL,
      completed_at INTEGER
    );
  `)
  return drizzle(sqlite, { schema })
}

// 静态初始化内存数据库单例
const testDbInstance = createTestDb()

// 用静态单例 Mock 数据库模块，确保完美应对 ES 模块静态绑定
vi.mock("@/db", () => ({
  db: testDbInstance,
}))

// 动态导入 WorkflowEngine 以加载 Mock db
const { WorkflowEngine } = await import("../workflow-engine")
import type { WorkflowNode, WorkflowEdge } from "../workflow-engine"

describe("WorkflowEngine 工作流引擎", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 清理表数据，保持单例引用不变
    testDbInstance.delete(schema.workflowExecutions).run()
    testDbInstance.delete(schema.workflows).run()
    testDbInstance.delete(schema.datasources).run()
  })

  describe("topologicalSort 拓扑排序", () => {
    it("顺序依赖可以正确排序", () => {
      const nodes: WorkflowNode[] = [
        { id: "node_2", type: "tool", config: {} },
        { id: "node_1", type: "agent", config: {} },
      ]
      const edges: WorkflowEdge[] = [{ source: "node_1", target: "node_2" }]

      const order = WorkflowEngine.topologicalSort(nodes, edges)
      expect(order[0].id).toBe("node_1")
      expect(order[1].id).toBe("node_2")
    })

    it("检测出循环依赖时应该抛出错误", () => {
      const nodes: WorkflowNode[] = [
        { id: "node_1", type: "agent", config: {} },
        { id: "node_2", type: "tool", config: {} },
      ]
      const edges: WorkflowEdge[] = [
        { source: "node_1", target: "node_2" },
        { source: "node_2", target: "node_1" },
      ]

      expect(() => WorkflowEngine.topologicalSort(nodes, edges)).toThrow("循环依赖")
    })
  })

  describe("execute 动态运行", () => {
    beforeEach(() => {
      // 写入测试数据源
      testDbInstance
        .insert(schema.datasources)
        .values({
          id: "ds-1",
          name: "Test DS",
          type: "rest",
          auth: JSON.stringify({ type: "none" }),
          config: JSON.stringify({ baseUrl: "http://api.test" }),
          endpoints: JSON.stringify([{ id: "ep-1", path: "/status", method: "POST", params: {} }]),
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .run()
    })

    it("成功执行多步骤工作流并记录 Trace 成功状态", async () => {
      // Mock Agent 执行返回
      mockGenerate.mockResolvedValue({ text: "Agent Reply Text" })
      // Mock Tool 执行返回
      mockQuery.mockResolvedValue({ success: true, data: { status: "updated" } })

      // 写入工作流定义
      const definition = {
        nodes: [
          {
            id: "node_1",
            type: "agent" as const,
            config: { agentId: "chatAgent", prompt: "请处理: {{input.content}}" },
          },
          {
            id: "node_2",
            type: "tool" as const,
            config: {
              datasourceId: "ds-1",
              endpointId: "ep-1",
              params: { status: "{{node_1.output.text}}" },
            },
          },
        ],
        edges: [{ source: "node_1", target: "node_2" }],
      }

      testDbInstance
        .insert(schema.workflows)
        .values({
          id: "wf-1",
          name: "测试工作流",
          definition: JSON.stringify(definition),
          status: "published",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .run()

      const result = await WorkflowEngine.execute("wf-1", { content: "重要订单" })

      // 验证最终执行结果是最后一步 Node2 的返回
      expect(result.success).toBe(true)
      expect(result.data.status).toBe("updated")

      // 验证 mock generate 调用参数正确
      expect(mockGenerate).toHaveBeenCalledWith("请处理: 重要订单")

      // 验证 mock query 执行参数已被变量替换为前置步骤输出
      expect(mockQuery).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ status: "Agent Reply Text" }),
      )

      // 验证数据库里已生成完备的 completed 执行记录
      const exec = testDbInstance
        .select()
        .from(schema.workflowExecutions)
        .where(eq(schema.workflowExecutions.workflowId, "wf-1"))
        .get()

      expect(exec).toBeDefined()
      if (!exec) throw new Error("exec is undefined")
      expect(exec.status).toBe("completed")
      expect(exec.completedAt).toBeInstanceOf(Date)

      // 验证日志 Trace
      const logs = JSON.parse(exec.logs || "[]")
      expect(logs).toHaveLength(2)
      expect(logs[0].nodeId).toBe("node_1")
      expect(logs[0].status).toBe("success")
      expect(logs[1].nodeId).toBe("node_2")
      expect(logs[1].status).toBe("success")
    })

    it("当某一步骤运行失败时应记录 failed 状态与异常日志", async () => {
      // Mock Agent 执行返回
      mockGenerate.mockResolvedValue({ text: "Agent Reply Text" })
      // Mock Tool 执行失败
      mockQuery.mockResolvedValue({ success: false, error: "网关超时" })

      const definition = {
        nodes: [
          {
            id: "node_1",
            type: "agent" as const,
            config: { agentId: "chatAgent", prompt: "请处理: {{input.content}}" },
          },
          {
            id: "node_2",
            type: "tool" as const,
            config: {
              datasourceId: "ds-1",
              endpointId: "ep-1",
              params: { status: "{{node_1.output.text}}" },
            },
          },
        ],
        edges: [{ source: "node_1", target: "node_2" }],
      }

      testDbInstance
        .insert(schema.workflows)
        .values({
          id: "wf-2",
          name: "异常工作流",
          definition: JSON.stringify(definition),
          status: "published",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .run()

      await expect(WorkflowEngine.execute("wf-2", { content: "异常" })).rejects.toThrow("网关超时")

      // 验证数据库状态为 failed 且记录了错误
      const exec = testDbInstance
        .select()
        .from(schema.workflowExecutions)
        .where(eq(schema.workflowExecutions.workflowId, "wf-2"))
        .get()

      expect(exec).toBeDefined()
      if (!exec) throw new Error("exec is undefined")
      expect(exec.status).toBe("failed")

      const logs = JSON.parse(exec.logs || "[]")
      expect(logs).toHaveLength(2)
      expect(logs[1].status).toBe("failed")
      expect(logs[1].error).toContain("网关超时")
    })
  })
})
