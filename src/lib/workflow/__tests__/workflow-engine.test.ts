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
    CREATE TABLE agent_datasources (
      agent_id TEXT NOT NULL,
      datasource_id TEXT NOT NULL,
      endpoint_ids TEXT,
      confirmation_required_endpoints TEXT,
      created_at INTEGER NOT NULL,
      PRIMARY KEY(agent_id, datasource_id)
    );
    CREATE TABLE agent_permissions (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      subject_type TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      permission_type TEXT NOT NULL DEFAULT 'read',
      created_at INTEGER NOT NULL
    );
    CREATE TABLE user_teams (
      user_id TEXT NOT NULL,
      team_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY(user_id, team_id)
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
import { topologicalSort } from "../topo-sort"
import type { WorkflowNode, WorkflowEdge } from "../topo-sort"

describe("WorkflowEngine 工作流引擎", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 清理表数据，保持单例引用不变
    testDbInstance.delete(schema.workflowExecutions).run()
    testDbInstance.delete(schema.workflows).run()
    testDbInstance.delete(schema.datasources).run()
    testDbInstance.delete(schema.customAgents).run()
    testDbInstance.delete(schema.agentDatasources).run()
    testDbInstance.delete(schema.agentPermissions).run()
    testDbInstance.delete(schema.userTeams).run()
  })

  describe("topologicalSort 拓扑排序", () => {
    it("顺序依赖可以正确排序", () => {
      const nodes: WorkflowNode[] = [
        { id: "node_2", type: "tool", config: {} },
        { id: "node_1", type: "agent", config: {} },
      ]
      const edges: WorkflowEdge[] = [{ source: "node_1", target: "node_2" }]

      const order = topologicalSort(nodes, edges)
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

      expect(() => topologicalSort(nodes, edges)).toThrow("循环依赖")
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

      const result = await WorkflowEngine.execute(
        "wf-1",
        { content: "重要订单" },
        { userId: "admin-id", role: "admin" },
      )

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

      await expect(
        WorkflowEngine.execute("wf-2", { content: "异常" }, { userId: "admin-id", role: "admin" }),
      ).rejects.toThrow("网关超时")

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

    it("当参数是单一占位符且输入为非 string 类型时应该保留原始类型", async () => {
      mockQuery.mockResolvedValue({ success: true, data: {} })

      const definition = {
        nodes: [
          {
            id: "node_2",
            type: "tool" as const,
            config: {
              datasourceId: "ds-1",
              endpointId: "ep-1",
              params: {
                limit: "{{input.limit}}",
                flag: "{{input.flag}}",
                mixed: "Limit is {{input.limit}}",
              },
            },
          },
        ],
        edges: [],
      }

      testDbInstance
        .insert(schema.workflows)
        .values({
          id: "wf-type-preserve",
          name: "类型保留测试",
          definition: JSON.stringify(definition),
          status: "published",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .run()

      await WorkflowEngine.execute(
        "wf-type-preserve",
        { limit: 100, flag: true },
        { userId: "admin-id", role: "admin" },
      )

      expect(mockQuery).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          limit: 100,
          flag: true,
          mixed: "Limit is 100",
        }),
      )
    })

    it("非管理员用户触发时，若未绑定数据源，应该抛出权限错误拦截", async () => {
      const definition = {
        nodes: [
          {
            id: "node_2",
            type: "tool" as const,
            config: {
              datasourceId: "ds-1",
              endpointId: "ep-1",
              params: {},
            },
          },
        ],
        edges: [],
      }

      testDbInstance
        .insert(schema.workflows)
        .values({
          id: "wf-auth-test-1",
          name: "越权拦截测试",
          definition: JSON.stringify(definition),
          status: "published",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .run()

      await expect(
        WorkflowEngine.execute("wf-auth-test-1", {}, { userId: "user-1", role: "user" }),
      ).rejects.toThrow("权限不足: 当前用户")
    })

    it("非管理员用户触发时，若接口需要二次确认，应该拦截写操作并抛错", async () => {
      // 1. 模拟一个写操作端点，例如 method = "POST"
      testDbInstance
        .insert(schema.datasources)
        .values({
          id: "ds-write",
          name: "Write DS",
          type: "rest",
          auth: JSON.stringify({ type: "none" }),
          config: JSON.stringify({ baseUrl: "http://api.test" }),
          endpoints: JSON.stringify([
            { id: "ep-write", path: "/update", method: "POST", params: {} },
          ]),
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .run()

      // 2. 将用户拥有的 agent-1 授权给 user-1
      testDbInstance
        .insert(schema.customAgents)
        .values({
          id: "agent-1",
          name: "Agent 1",
          systemPrompt: "prompt",
          enabled: true,
          isBuiltin: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .run()

      // 给 user-1 分配 agent-1 权限
      testDbInstance
        .insert(schema.agentPermissions)
        .values({
          id: "perm-1",
          agentId: "agent-1",
          subjectType: "user",
          subjectId: "user-1",
          permissionType: "read",
          createdAt: new Date(),
        })
        .run()

      // 3. 将此 Agent 绑定到该数据源，并且限制端点为 ep-write，同时将 ep-write 设置为需要二次确认
      testDbInstance
        .insert(schema.agentDatasources)
        .values({
          agentId: "agent-1",
          datasourceId: "ds-write",
          endpointIds: JSON.stringify(["ep-write"]),
          confirmationRequiredEndpoints: JSON.stringify(["ep-write"]),
          createdAt: new Date(),
        })
        .run()

      const definition = {
        nodes: [
          {
            id: "node_write",
            type: "tool" as const,
            config: {
              datasourceId: "ds-write",
              endpointId: "ep-write",
              params: {},
            },
          },
        ],
        edges: [],
      }

      testDbInstance
        .insert(schema.workflows)
        .values({
          id: "wf-write-block-test",
          name: "写操作拦截测试",
          definition: JSON.stringify(definition),
          status: "published",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .run()

      // 4. 普通用户触发含有二次确认写接口的工作流应该抛错拦截
      await expect(
        WorkflowEngine.execute("wf-write-block-test", {}, { userId: "user-1", role: "user" }),
      ).rejects.toThrow("需要二次确认，工作流引擎禁止直接执行写操作")
    })

    it("工作流定义不符合 Zod schema 时，应该抛出格式不正确错误", async () => {
      const definition = {
        invalid_property: "test",
      }

      testDbInstance
        .insert(schema.workflows)
        .values({
          id: "wf-invalid-schema",
          name: "损坏工作流",
          definition: JSON.stringify(definition),
          status: "published",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .run()

      await expect(
        WorkflowEngine.execute("wf-invalid-schema", {}, { userId: "admin-id", role: "admin" }),
      ).rejects.toThrow("工作流定义损坏或格式不正确")
    })
  })
})
