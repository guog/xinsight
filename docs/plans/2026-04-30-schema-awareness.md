# Schema 感知 + Agent 提示词增强 实现计划

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 让 Agent 自动了解已绑定数据源的字段结构，生成精准查询，提供高质量数据洞察。

**Architecture:**

- endpoint 定义新增 `responseSchema` 字段描述返回数据结构
- 新增 schema 推断服务：从实际 API 响应自动推断字段结构
- OpenAPI 导入和 GraphQL introspection 时自动提取 response schema
- Agent system prompt 动态注入数据源 schema 摘要
- 管理员 UI 支持 schema 查看/编辑/探测

**Tech Stack:** Bun + TypeScript + Next.js 16 + Mastra + Zod v4 + Drizzle ORM

---

## Task 1: 定义 ResponseSchema 类型

**Objective:** 在 types.ts 中新增 ResponseSchema Zod schema 并集成到各协议 endpoint 定义中。

**Files:**

- Modify: `src/mastra/tools/datasource/types.ts`
- Create: `src/mastra/tools/datasource/types.test.ts`

**实现：**

在 types.ts 中新增：

```typescript
// 字段定义 schema（递归）
const FieldDefinitionSchema: z.ZodType<FieldDefinition> = z.lazy(() =>
  z.object({
    name: z.string(),
    type: z.enum(["string", "number", "boolean", "object", "array", "null"]),
    description: z.optional(z.string()),
    children: z.optional(z.array(FieldDefinitionSchema)),
  }),
)

// 响应 schema
const ResponseSchemaDefinition = z.object({
  fields: z.array(FieldDefinitionSchema),
  description: z.optional(z.string()),
  discoveredAt: z.optional(z.string()), // ISO timestamp
  source: z.optional(z.enum(["manual", "inferred", "openapi", "introspection"])),
})
```

在各 endpoint schema 中添加 `responseSchema: z.optional(ResponseSchemaDefinition)`。

---

## Task 2: Schema 推断服务

**Objective:** 从 API 实际响应 JSON 自动推断字段结构。

**Files:**

- Create: `src/lib/schema/infer-schema.ts`
- Create: `src/lib/schema/infer-schema.test.ts`

**实现：**

- `inferSchema(data: unknown, maxDepth = 3): FieldDefinition[]`
- 处理 object/array/primitives
- 数组取第一个元素推断子结构
- 递归限制最大 3 层

---

## Task 3: OpenAPI 导入时提取 response schema

**Objective:** 在 openapi-parser.ts 导入 endpoint 时自动提取 200 响应的 schema 并转为 ResponseSchema。

**Files:**

- Modify: `src/lib/importers/openapi-parser.ts`
- Modify: `src/lib/importers/openapi-parser.test.ts`

**实现：**

- 解析 `responses.200.content.application/json.schema`
- 将 OpenAPI JSON Schema 转为 FieldDefinition[]
- 填充到 endpoint.responseSchema

---

## Task 4: GraphQL introspection 提取 return type

**Objective:** introspection 时将 query/mutation 的返回类型转为 ResponseSchema。

**Files:**

- Modify: `src/lib/importers/graphql-introspector.ts`
- Modify: `src/lib/importers/graphql-introspector.test.ts`

**实现：**

- 从 introspection 结果中提取 field type 信息
- 递归解析 OBJECT/LIST/SCALAR 类型
- 填充到 endpoint.responseSchema

---

## Task 5: Schema 探测 API

**Objective:** 管理员可对 endpoint 发起真实请求，自动推断并保存 response schema。

**Files:**

- Create: `src/app/api/datasources/[id]/endpoints/[endpointId]/discover-schema/route.ts`
- Create: `src/app/api/datasources/[id]/endpoints/[endpointId]/discover-schema/route.test.ts`

**实现：**

- POST 请求，使用 adapter.query() 发起真实调用
- 对响应 data 调用 inferSchema()
- 更新 endpoint 的 responseSchema 字段并保存到 DB
- 仅允许 admin 角色

---

## Task 6: Agent 动态 system prompt 注入

**Objective:** Agent 在对话时自动将绑定数据源的 schema 摘要注入 system prompt。

**Files:**

- Create: `src/lib/schema/build-context.ts`
- Create: `src/lib/schema/build-context.test.ts`
- Modify: `src/app/api/chat/route.ts`

**实现：**

- `buildDatasourceContext(agentId: string): string` — 生成数据源摘要文本
- 格式：数据源名称 + 各 endpoint 的参数和响应字段
- Token 限制：截断到 2000 字符以内
- 在 chat route 中将 context 追加到 agent 的 system prompt

---

## Task 7: 管理员 UI — Schema 展示与编辑

**Objective:** 数据源详情页展示 schema 信息，支持手动编辑和探测。

**Files:**

- Create: `src/components/datasource/schema-viewer.tsx`
- Create: `src/components/datasource/schema-editor.tsx`
- Modify: `src/components/datasource-form.tsx`（集成 schema 面板）

**实现：**

- 树形展示字段结构（名称 + 类型 + 描述）
- 内联编辑字段描述（业务含义）
- "探测 Schema" 按钮调用 discover-schema API
- Schema 来源标签（手动/推断/OpenAPI/Introspection）

---

## Task 8: datasourceListTool 输出增强

**Objective:** datasourceListTool 返回数据中包含 responseSchema 摘要，让 Agent 在 tool 调用时也能看到字段信息。

**Files:**

- Modify: `src/mastra/tools/datasource/index.ts`
- Modify: 相关测试文件

**实现：**

- endpoint 输出增加 `responseFields` 字段（精简的字段名+类型列表）
- 控制输出大小，避免 token 爆炸

---

## 验收标准

1. OpenAPI 导入后 endpoint 自动带有 responseSchema
2. GraphQL introspection 后 endpoint 自动带有 responseSchema
3. 管理员点击"探测"按钮可自动发现并保存 schema
4. 管理员可手动编辑字段描述
5. Agent 对话时 system prompt 包含数据源 schema 摘要
6. Agent 调用 datasourceListTool 能看到字段信息
7. 所有新增代码有测试覆盖
