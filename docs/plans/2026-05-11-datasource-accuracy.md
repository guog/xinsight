# 数据源配置与查询准确性全面优化 — 实施计划

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 彻底解决数据源从配置到查询的全链路准确性和易用性问题

**Architecture:**

1. 结构化参数 Schema 替代自由文本 paramSchema
2. Agent 系统提示词动态注入数据源上下文（复用 buildDatasourceContext）
3. OpenAPI 导入增强（自动填充结构化参数+响应 schema+中文描述）
4. 查询预校验+自动纠错重试
5. 连接测试增强（HTTP 状态码+诊断建议）
6. 端点级绑定 UI

**Tech Stack:** Bun, TypeScript, Next.js 16, Mastra, Drizzle, SQLite, Zod

---

## Task 1: 结构化参数 Schema — 类型定义

**Objective:** 在 types.ts 中新增 StructuredParam 类型，替代自由文本 paramSchema

**Files:**

- Modify: `src/mastra/tools/datasource/types.ts`

**Changes:**

- 新增 `StructuredParamSchema` Zod schema:
  ```ts
  export const StructuredParamSchema = z.object({
    name: z.string().min(1),
    type: z.enum(["string", "number", "boolean", "date", "enum", "object", "array"]),
    required: z.boolean().default(false),
    description: z.string().optional(),
    default: z.unknown().optional(),
    enum: z.array(z.string()).optional(),
    example: z.unknown().optional(),
    format: z.string().optional(), // e.g. "yyyy-MM-dd", "email"
  })
  ```
- 在 endpointBaseFields 中新增 `structuredParams: z.array(StructuredParamSchema).optional()`
- 保留 `paramSchema` 字段做向后兼容

---

## Task 2: OpenAPI 导入增强 — 结构化参数映射

**Objective:** parseOpenApiSpec 导入时自动映射为 structuredParams

**Files:**

- Modify: `src/lib/importers/openapi-parser.ts`

**Changes:**

- 新增 `extractStructuredParams(operation)` 函数：从 OpenAPI parameters + requestBody 提取结构化参数
- 每个 endpoint 新增 `structuredParams` 字段
- path 参数、query 参数、requestBody 的 properties 都要提取
- 保留 required/description/enum/default/example/format 信息

---

## Task 3: AI 辅助生成端点描述

**Objective:** 提供 API 端点，基于 path/method/params/response 自动生成中文描述

**Files:**

- Create: `src/app/api/datasources/generate-descriptions/route.ts`

**Changes:**

- POST 接口，接收 endpoints 数组
- 用规则引擎（不调用 LLM，避免依赖）生成中文描述：
  - `GET /api/production/daily` → "查询每日生产数据"
  - `POST /api/orders` → "创建订单"
  - 基于 method + path segments + params 推断
- 返回 endpoints 数组（补充了 description）

---

## Task 4: datasource-list 增强 — 返回结构化参数和响应 schema

**Objective:** datasource-list 工具返回 structuredParams，让 LLM 精确理解每个参数

**Files:**

- Modify: `src/mastra/tools/datasource/index.ts`

**Changes:**

- datasourceListTool 的 outputSchema 和 execute 中：
  - 每个 endpoint 返回 `structuredParams`（如果有）
  - 返回 `responseSchema.fields`（已有，保持）
  - 优化 description：优先 endpoint.description，fallback 到自动生成
- 更新工具 description，去掉"请先调用此工具"的措辞（因为 Agent 已经注入上下文了）

---

## Task 5: Agent 上下文注入 — 动态拼接数据源摘要到 instructions

**Objective:** Agent 构造时注入数据源上下文，第一轮就能直接查询

**Files:**

- Modify: `src/lib/schema/build-context.ts`
- Modify: `src/app/api/chat/route.ts`

**Changes:**

- `buildDatasourceContext` 增强：
  - 包含 structuredParams 信息（参数名+类型+必填+描述+枚举值）
  - 包含 responseSchema fields
  - MAX_LENGTH 提升到 4000
- chat route 中：调用 `buildDatasourceContext(agentId)` 并通过 agent.generate/stream 的 system prompt 或 prepend instructions 注入
- 在 Mastra Agent 的 stream 调用中通过 `instructions` 参数动态附加上下文

---

## Task 6: 查询预校验 — datasource-query 参数验证

**Objective:** 调用 API 前校验参数类型和必填项，返回明确错误信息

**Files:**

- Modify: `src/mastra/tools/datasource/index.ts`
- Create: `src/mastra/tools/datasource/validate-params.ts`

**Changes:**

- 新增 `validateParams(structuredParams, userParams)` 函数：
  - 检查必填参数
  - 检查类型匹配（date 格式校验、number 类型校验）
  - 检查 enum 值是否合法
  - 返回 `{ valid: boolean, errors: string[] }`
- datasource-query execute 中：如果 endpoint 有 structuredParams，先校验再调用
- 校验失败返回明确错误："参数 'startDate' 为必填项" / "参数 'status' 的值 'xxx' 不在允许范围 [pending, completed, cancelled] 中"

---

## Task 7: 自动纠错重试 — 错误信息增强

**Objective:** API 返回错误时给 LLM 提供明确的纠正指引

**Files:**

- Modify: `src/mastra/tools/datasource/index.ts`
- Modify: `src/mastra/tools/datasource/adapters/rest-adapter.ts`

**Changes:**

- RestAdapter.query 增强错误返回：
  - 包含 HTTP status code
  - 包含响应体预览（截断到 500 字符）
  - 常见错误诊断："400 Bad Request — 请检查参数格式" / "401 Unauthorized — 认证信息无效" / "404 Not Found — 请确认接口路径"
- datasource-query 工具错误返回增加 `paramHints` 字段：如果有 structuredParams，在错误时附上正确的参数规范供 LLM 重试

---

## Task 8: 连接测试增强 — 详细诊断

**Objective:** 连接测试返回详细信息（HTTP 状态码、延迟、响应预览、诊断建议）

**Files:**

- Modify: `src/mastra/tools/datasource/adapters/rest-adapter.ts`
- Modify: `src/mastra/tools/datasource/adapters/graphql-adapter.ts`
- Modify: `src/app/api/datasources/test-connection/route.ts`
- Modify: `src/app/api/datasources/[id]/test/route.ts`

**Changes:**

- testConnection 返回增强为 `{ ok, message, statusCode?, latency?, responsePreview?, diagnosis? }`
- diagnosis 字段：根据 statusCode 给出中文诊断建议
- test-connection route 已返回 latency，保持
- 前端详情页测试按钮显示完整诊断信息

---

## Task 9: 端点级绑定 UI

**Objective:** Agent 绑定界面增加端点勾选

**Files:**

- Modify: `src/components/datasource-form.tsx`

**Changes:**

- Agent 绑定区域：每个 Agent 旁边增加"选择端点"下拉/弹窗
- 默认全选（endpointIds = null = 全部）
- 可展开选择特定端点
- 绑定时传 endpointIds 到 API

---

## Task 10: 自动 discover-schema — 首次保存后自动采样

**Objective:** 数据源保存并测试成功后，自动对每个端点执行 discover-schema

**Files:**

- Modify: `src/app/api/datasources/[id]/test/route.ts`

**Changes:**

- 测试成功后，异步对没有 responseSchema 的 endpoint 执行 discover-schema
- 不阻塞测试响应
- 结果写回 endpoints[].responseSchema

---

## Task 11: 前端连接测试详情 UI

**Objective:** 测试结果显示状态码、延迟、诊断建议

**Files:**

- Modify: `src/app/admin/datasources/[id]/page.tsx`
- Modify: `src/components/datasource-form.tsx` (ConnectionTestButton)

**Changes:**

- ConnectionTestButton 显示：状态码、延迟、诊断建议
- 详情页测试按钮同步增强
