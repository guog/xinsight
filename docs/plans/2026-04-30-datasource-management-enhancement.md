# 数据源管理完善 实现计划

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 全面改善数据源管理的易用性：协议差异化表单、OpenAPI/GraphQL 导入、表单内连接测试、列表页增强。

**Architecture:**

- 前端：按协议拆分 endpoint 表单组件，新增导入器组件（OpenAPI URL/粘贴、GraphQL introspection）
- 后端：新增 `/api/datasources/import-openapi`、`/api/datasources/introspect` API；扩展 `/api/datasources/test` 支持无 ID 测试（表单内验证）
- 数据层：扩展 endpoint schema 增加协议专属字段（method/path/operationType 等）

**Tech Stack:** Next.js 16 App Router, Bun, TypeScript, Zod v4, Tailwind CSS

---

## Phase 1: 数据模型扩展（协议差异化）

### Task 1: 扩展 Endpoint 类型定义

**Objective:** 为每种协议定义专属的 endpoint 字段

**Files:**

- Modify: `src/mastra/tools/datasource/types.ts`
- Create: `src/mastra/tools/datasource/__tests__/types.test.ts`

**Step 1: 写失败测试**

```typescript
// src/mastra/tools/datasource/__tests__/types.test.ts
import { describe, test, expect } from "bun:test"
import {
  RestEndpointSchema,
  GraphqlEndpointSchema,
  GrpcEndpointSchema,
  OpcuaEndpointSchema,
  MqttEndpointSchema,
} from "../types"

describe("协议差异化 Endpoint Schema", () => {
  test("REST endpoint 需要 method 和 path", () => {
    const valid = RestEndpointSchema.parse({
      id: "get-users",
      name: "获取用户列表",
      method: "GET",
      path: "/users",
    })
    expect(valid.method).toBe("GET")
    expect(valid.path).toBe("/users")
  })

  test("REST endpoint 缺少 method 应报错", () => {
    expect(() => RestEndpointSchema.parse({ id: "x", name: "x", path: "/x" })).toThrow()
  })

  test("GraphQL endpoint 需要 operationType 和 operationName", () => {
    const valid = GraphqlEndpointSchema.parse({
      id: "get-users",
      name: "获取用户",
      operationType: "query",
      operationName: "GetUsers",
      query: "query GetUsers { users { id name } }",
    })
    expect(valid.operationType).toBe("query")
  })

  test("gRPC endpoint 需要 service 和 method", () => {
    const valid = GrpcEndpointSchema.parse({
      id: "get-user",
      name: "获取用户",
      service: "user.UserService",
      method: "GetUser",
    })
    expect(valid.service).toBe("user.UserService")
  })

  test("OPC UA endpoint 需要 nodeIds 和 action", () => {
    const valid = OpcuaEndpointSchema.parse({
      id: "read-temp",
      name: "读取温度",
      action: "read",
      nodeIds: ["ns=2;s=Temperature"],
    })
    expect(valid.action).toBe("read")
  })

  test("MQTT endpoint 需要 topic 和 direction", () => {
    const valid = MqttEndpointSchema.parse({
      id: "sensor-data",
      name: "传感器数据",
      topic: "sensors/+/temperature",
      direction: "subscribe",
      qos: 1,
    })
    expect(valid.direction).toBe("subscribe")
  })
})
```

**Step 2: 运行测试确认失败**

```bash
bun test src/mastra/tools/datasource/__tests__/types.test.ts
```

**Step 3: 实现协议差异化 Schema**

在 `types.ts` 中新增：

```typescript
/** 基础 endpoint 字段 */
const BaseEndpointFields = {
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  paramSchema: z.string().optional(),
  apiSchemaFormat: ApiSchemaFormat,
  responseExample: z.string().optional(),
}

/** REST 专属 endpoint */
export const RestEndpointSchema = z.object({
  ...BaseEndpointFields,
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  path: z.string().min(1), // 如 /users/{id}
  queryParams: z.record(z.string(), z.string()).optional(),
  requestBody: z.string().optional(), // JSON Schema 或自然语言
  headers: z.record(z.string(), z.string()).optional(),
})
export type RestEndpoint = z.infer<typeof RestEndpointSchema>

/** GraphQL 专属 endpoint */
export const GraphqlEndpointSchema = z.object({
  ...BaseEndpointFields,
  operationType: z.enum(["query", "mutation", "subscription"]),
  operationName: z.string().min(1),
  query: z.string().min(1), // 完整 GraphQL query 文本
  variables: z.string().optional(), // 变量的 JSON Schema
})
export type GraphqlEndpoint = z.infer<typeof GraphqlEndpointSchema>

/** gRPC 专属 endpoint */
export const GrpcEndpointSchema = z.object({
  ...BaseEndpointFields,
  service: z.string().min(1),
  method: z.string().min(1),
  requestMessage: z.string().optional(), // protobuf message schema
  responseMessage: z.string().optional(),
})
export type GrpcEndpoint = z.infer<typeof GrpcEndpointSchema>

/** OPC UA 专属 endpoint */
export const OpcuaEndpointSchema = z.object({
  ...BaseEndpointFields,
  action: z.enum(["read", "write", "browse"]),
  nodeIds: z.array(z.string().min(1)),
  dataType: z.string().optional(),
})
export type OpcuaEndpoint = z.infer<typeof OpcuaEndpointSchema>

/** MQTT 专属 endpoint */
export const MqttEndpointSchema = z.object({
  ...BaseEndpointFields,
  topic: z.string().min(1),
  direction: z.enum(["publish", "subscribe", "both"]),
  qos: z.number().min(0).max(2).default(0),
  payloadFormat: z.enum(["json", "text", "binary"]).default("json"),
})
export type MqttEndpoint = z.infer<typeof MqttEndpointSchema>

/** 统一的 Endpoint 类型（按协议区分） */
export type ProtocolEndpoint =
  | RestEndpoint
  | GraphqlEndpoint
  | GrpcEndpoint
  | OpcuaEndpoint
  | MqttEndpoint

/** 根据协议获取对应 schema */
export const EndpointSchemaByType = {
  rest: RestEndpointSchema,
  graphql: GraphqlEndpointSchema,
  grpc: GrpcEndpointSchema,
  opcua: OpcuaEndpointSchema,
  mqtt: MqttEndpointSchema,
} as const
```

**Step 4: 运行测试确认通过**

```bash
bun test src/mastra/tools/datasource/__tests__/types.test.ts
```

**Step 5: 提交**

```bash
git add src/mastra/tools/datasource/types.ts src/mastra/tools/datasource/__tests__/types.test.ts
git commit -m "feat(datasource): 协议差异化 endpoint schema"
```

---

### Task 2: 兼容旧数据 — endpoint 迁移工具

**Objective:** 现有数据库中的通用 endpoint 结构平滑迁移到新的协议专属结构

**Files:**

- Create: `src/db/migrations/migrate-endpoints.ts`
- Create: `src/db/migrations/__tests__/migrate-endpoints.test.ts`

**实现要点：**

- 旧格式的 endpoint 缺少 method/path 等字段，迁移时填默认值：REST 默认 GET + path 从 id 推导
- 保持向后兼容：DatasourceEndpointSchema 保留为宽松模式（optional 新字段），新增 strict schema 仅用于表单校验
- 迁移脚本幂等可重复执行

---

## Phase 2: OpenAPI 导入

### Task 3: OpenAPI 解析器

**Objective:** 解析 OpenAPI 3.x JSON/YAML spec，提取 endpoints 转为 RestEndpoint[]

**Files:**

- Create: `src/lib/importers/openapi-parser.ts`
- Create: `src/lib/importers/__tests__/openapi-parser.test.ts`

**Step 1: 写失败测试**

```typescript
import { describe, test, expect } from "bun:test"
import { parseOpenApiSpec } from "../openapi-parser"

describe("OpenAPI 解析器", () => {
  test("解析简单 OpenAPI 3.0 spec", () => {
    const spec = {
      openapi: "3.0.0",
      info: { title: "Test", version: "1.0" },
      paths: {
        "/users": {
          get: {
            operationId: "getUsers",
            summary: "获取用户列表",
            parameters: [{ name: "page", in: "query", schema: { type: "integer" } }],
            responses: {
              "200": {
                description: "成功",
                content: { "application/json": { schema: { type: "array" } } },
              },
            },
          },
          post: {
            operationId: "createUser",
            summary: "创建用户",
            requestBody: {
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { name: { type: "string" }, email: { type: "string" } },
                    required: ["name", "email"],
                  },
                },
              },
            },
          },
        },
      },
    }

    const result = parseOpenApiSpec(spec)
    expect(result.endpoints).toHaveLength(2)
    expect(result.endpoints[0].method).toBe("GET")
    expect(result.endpoints[0].path).toBe("/users")
    expect(result.endpoints[0].id).toBe("getUsers")
    expect(result.endpoints[1].method).toBe("POST")
    expect(result.endpoints[1].requestBody).toBeDefined()
    expect(result.baseUrl).toBeUndefined() // 无 servers 时为空
  })

  test("提取 servers[0] 作为 baseUrl", () => {
    const spec = {
      openapi: "3.0.0",
      info: { title: "Test", version: "1.0" },
      servers: [{ url: "https://api.example.com/v1" }],
      paths: {},
    }
    const result = parseOpenApiSpec(spec)
    expect(result.baseUrl).toBe("https://api.example.com/v1")
  })

  test("支持 YAML 字符串输入", () => {
    const yaml = `
openapi: "3.0.0"
info:
  title: Test
  version: "1.0"
paths:
  /health:
    get:
      operationId: healthCheck
      summary: 健康检查
`
    const result = parseOpenApiSpec(yaml)
    expect(result.endpoints).toHaveLength(1)
    expect(result.endpoints[0].path).toBe("/health")
  })

  test("解析 URL 远程拉取", async () => {
    // 使用真实的公开 OpenAPI spec
    const result = await parseOpenApiSpec("https://petstore3.swagger.io/api/v3/openapi.json")
    expect(result.endpoints.length).toBeGreaterThan(0)
    expect(result.baseUrl).toBeDefined()
  })
})
```

**Step 3: 实现**

```typescript
// src/lib/importers/openapi-parser.ts
import yaml from "yaml" // 需要 bun add yaml

export interface ParsedOpenApiResult {
  baseUrl?: string
  endpoints: RestEndpoint[]
  info: { title: string; version: string }
  securitySchemes?: Record<string, unknown>
}

export async function parseOpenApiSpec(
  input: string | Record<string, unknown>,
): Promise<ParsedOpenApiResult> {
  // 1. 如果是 URL，fetch 获取
  // 2. 如果是字符串，尝试 JSON.parse，否则 yaml.parse
  // 3. 遍历 paths，为每个 operation 生成 RestEndpoint
  // 4. 提取 servers[0].url 作为 baseUrl
  // 5. 提取 securitySchemes 用于推荐认证方式
}
```

**依赖安装：**

```bash
bun add yaml
```

---

### Task 4: OpenAPI 导入 API

**Objective:** 后端接口接收 OpenAPI spec（URL 或 JSON/YAML 文本），返回解析结果

**Files:**

- Create: `src/app/api/datasources/import-openapi/route.ts`
- Create: `src/app/api/datasources/__tests__/import-openapi.test.ts`

**接口设计：**

```
POST /api/datasources/import-openapi
Body: { url?: string, content?: string }
Response: { baseUrl, endpoints[], info, securitySchemes }
```

---

### Task 5: GraphQL Introspection API

**Objective:** 连接 GraphQL 服务自动发现 schema，提取可用 query/mutation

**Files:**

- Create: `src/lib/importers/graphql-introspector.ts`
- Create: `src/lib/importers/__tests__/graphql-introspector.test.ts`
- Create: `src/app/api/datasources/introspect-graphql/route.ts`

**接口设计：**

```
POST /api/datasources/introspect-graphql
Body: { endpoint: string, headers?: Record<string, string> }
Response: { queries: GraphqlEndpoint[], mutations: GraphqlEndpoint[] }
```

---

## Phase 3: 表单内连接测试

### Task 6: 无 ID 连接测试 API

**Objective:** 支持在创建表单中（尚未保存）测试连接

**Files:**

- Create: `src/app/api/datasources/test-connection/route.ts`
- Create: `src/app/api/datasources/__tests__/test-connection.test.ts`

**接口设计：**

```
POST /api/datasources/test-connection
Body: { type, config, auth }  // 与保存时相同结构，但不需要 id/name
Response: { ok: boolean, message: string, latency?: number }
```

**实现：** 复用现有 adapter 的 testConnection 逻辑，组装临时 DatasourceConfig 调用。

---

## Phase 4: 协议差异化表单组件

### Task 7: REST Endpoint 表单组件

**Objective:** REST 专属表单：method 选择器 + path 输入 + query params 表格 + request body editor

**Files:**

- Create: `src/components/datasource/rest-endpoint-form.tsx`
- Create: `src/components/datasource/__tests__/rest-endpoint-form.test.tsx`

**表单字段：**

- HTTP Method（下拉：GET/POST/PUT/PATCH/DELETE）
- Path（输入框，支持 `{param}` 路径参数高亮）
- Query Parameters（key-value 动态表格）
- Request Body Schema（代码编辑器，JSON Schema）
- Response Example（代码编辑器）
- Description（文本框）

---

### Task 8: GraphQL Endpoint 表单组件

**Objective:** GraphQL 专属表单：operation type + query 编辑器 + variables schema

**Files:**

- Create: `src/components/datasource/graphql-endpoint-form.tsx`

**表单字段：**

- Operation Type（query/mutation/subscription）
- Operation Name
- Query（多行代码编辑器，GraphQL 语法）
- Variables Schema（JSON Schema 编辑器）
- 「从 Introspection 导入」按钮

---

### Task 9: gRPC Endpoint 表单组件

**Files:**

- Create: `src/components/datasource/grpc-endpoint-form.tsx`

**表单字段：**

- Service（如 `user.UserService`）
- Method（如 `GetUser`）
- Request Message Schema
- Response Message Schema
- 「从 Proto 文件导入」按钮（后续）

---

### Task 10: OPC UA Endpoint 表单组件

**Files:**

- Create: `src/components/datasource/opcua-endpoint-form.tsx`

**表单字段：**

- Action（read/write/browse）
- Node IDs（标签输入，支持多个）
- Data Type（可选）

---

### Task 11: MQTT Endpoint 表单组件

**Files:**

- Create: `src/components/datasource/mqtt-endpoint-form.tsx`

**表单字段：**

- Topic（支持通配符 +/#）
- Direction（publish/subscribe/both）
- QoS（0/1/2）
- Payload Format（json/text/binary）

---

### Task 12: 统一数据源表单重构

**Objective:** 重写 `datasource-form.tsx`，整合协议差异化组件 + 导入 + 表单内测试

**Files:**

- Modify: `src/components/datasource-form.tsx`（大幅重写）
- Create: `src/components/datasource/connection-test-button.tsx`
- Create: `src/components/datasource/openapi-import-dialog.tsx`
- Create: `src/components/datasource/graphql-import-dialog.tsx`

**新增交互：**

1. 连接配置区域新增「测试连接」按钮（调用 `/api/datasources/test-connection`）
2. REST 类型时，endpoint 区域顶部新增「从 OpenAPI 导入」按钮
3. GraphQL 类型时，endpoint 区域顶部新增「Introspection 自动发现」按钮
4. 切换协议时，endpoint 表单自动切换为对应协议组件

---

## Phase 5: 列表页增强

### Task 13: 列表页搜索与筛选

**Objective:** 添加搜索框（按名称/描述模糊搜索）+ 类型筛选 tabs

**Files:**

- Modify: `src/app/admin/datasources/page.tsx`

---

### Task 14: 健康状态指示器

**Objective:** 显示最后连接测试结果、最后调用时间

**Files:**

- Modify: `src/db/schema.ts`（添加 lastTestedAt, lastTestResult, lastCalledAt 字段）
- Modify: `src/db/repositories/datasource-repository.ts`
- Modify: `src/app/admin/datasources/page.tsx`
- Modify: `src/app/api/datasources/[id]/test/route.ts`（测试后更新状态）

---

### Task 15: 快速操作（复制、批量启停）

**Objective:** 列表支持一键复制数据源、批量启用/禁用

**Files:**

- Modify: `src/app/admin/datasources/page.tsx`
- Create: `src/app/api/datasources/[id]/duplicate/route.ts`
- Create: `src/app/api/datasources/batch/route.ts`

---

## Phase 6: Adapter 适配新 Endpoint 结构

### Task 16: REST Adapter 使用新字段

**Objective:** adapter query 时从 RestEndpoint 的 method/path 构建请求，而非纯 params

**Files:**

- Modify: `src/mastra/tools/datasource/adapters/rest-adapter.ts`
- Modify: `src/mastra/tools/datasource/adapters/__tests__/rest-adapter.test.ts`

---

### Task 17: GraphQL Adapter 使用新字段

**Files:**

- Modify: `src/mastra/tools/datasource/adapters/graphql-adapter.ts`
- Modify: `src/mastra/tools/datasource/adapters/__tests__/graphql-adapter.test.ts`

---

### Task 18: OPC UA / MQTT / gRPC Adapter 适配

**Files:**

- Modify: `src/mastra/tools/datasource/adapters/opcua-adapter.ts`
- Modify: `src/mastra/tools/datasource/adapters/mqtt-adapter.ts`
- Modify: `src/mastra/tools/datasource/adapters/grpc-adapter.ts`
- 对应测试文件

---

## Phase 7: 集成测试与端到端验证

### Task 19: 集成测试

**Objective:** 完整流程测试：创建 → OpenAPI 导入 → 测试连接 → 编辑 → 复制 → 删除

**Files:**

- Create: `src/app/api/datasources/__tests__/datasource-flow.test.ts`

---

### Task 20: 全量测试 + Build 验证

```bash
bun test
bun run build
```

---

## 实现顺序与依赖

```
Phase 1 (数据模型) → Phase 2 (导入器) → Phase 3 (测试API)
                 ↘ Phase 6 (Adapter适配)
Phase 4 (表单组件) 依赖 Phase 1 + 2 + 3
Phase 5 (列表增强) 独立可并行
Phase 7 (集成测试) 最后
```

**预计分支：** `feat/datasource-management-enhancement`
