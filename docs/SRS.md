# xinsight 软件需求规格说明书 (SRS)

> **版本:** 1.0  
> **最后更新:** 2026-04-30  
> **状态:** 活跃开发中  
> **关联文档:** [PRD.md](./PRD.md)

---

## 1. 引言

### 1.1 目的

本文档详细描述 xinsight 系统的软件需求规格，为开发、测试和验收提供技术基准。面向开发工程师、QA 和技术负责人。

### 1.2 范围

xinsight 是一款多 Agent AI 数据洞察助手，涵盖：

- 用户认证与授权
- 多 Agent AI 对话（流式）
- 多协议数据源管理与查询
- 知识库文档管理与检索
- 管理后台

### 1.3 术语与缩写

| 术语       | 定义                                 |
| ---------- | ------------------------------------ |
| Agent      | 具备特定工具和 prompt 的 AI 对话实体 |
| Datasource | 外部数据服务连接配置                 |
| Endpoint   | 数据源内具体 API 接口/主题/节点      |
| Adapter    | 统一查询接口到特定协议的翻译层       |
| Schema     | API 返回数据的字段结构描述           |
| Wiki       | 知识库，存储文档供 Agent 检索        |
| Tool       | Mastra 框架中 Agent 可调用的功能单元 |

### 1.4 参考文档

- [PRD.md](./PRD.md) — 产品需求文档
- [Mastra 文档](https://mastra.ai/docs)
- [Vercel AI SDK v6](https://ai-sdk.dev)
- [Next.js 16 文档](https://nextjs.org/docs)

---

## 2. 系统概述

### 2.1 系统上下文

```
┌──────────┐     HTTPS      ┌────────────────┐     各协议     ┌──────────────┐
│  浏览器   │ ◄────────────► │   xinsight     │ ◄────────────► │  外部数据源   │
│ (用户端)  │                │  (Next.js 16)  │                │ REST/GQL/...│
└──────────┘                └───────┬────────┘                └──────────────┘
                                    │
                                    ▼
                            ┌───────────────┐
                            │  LLM Provider │
                            │ (DeepSeek/    │
                            │  OpenAI/...)  │
                            └───────────────┘
```

### 2.2 用户角色

| 角色    | 权限                                                   |
| ------- | ------------------------------------------------------ |
| `admin` | 所有功能：数据源管理、Agent 管理、知识库管理、用户管理 |
| `user`  | 对话、查看知识库、提交反馈                             |

### 2.3 运行环境

| 项目   | 要求                                      |
| ------ | ----------------------------------------- |
| 运行时 | Bun ≥ 1.1                                 |
| OS     | Linux / macOS / Windows (WSL)             |
| 浏览器 | Chrome / Firefox / Safari / Edge 最新两版 |
| 存储   | SQLite（bun:sqlite），本地文件系统        |
| 网络   | 需联网访问 LLM API                        |

---

## 3. 功能需求

### 3.1 FR-AUTH: 用户认证系统

#### FR-AUTH-01: 用户注册

| 属性 | 描述                                                                  |
| ---- | --------------------------------------------------------------------- |
| 输入 | username (3-20 字符, 字母数字下划线), password (≥6 字符), displayName |
| 处理 | 校验唯一性 → bcrypt 哈希密码 → 插入 users 表 → 自动登录               |
| 输出 | 201 + Set-Cookie (session)                                            |
| 异常 | 400 用户名已存在 / 参数不合法                                         |

#### FR-AUTH-02: 用户登录

| 属性 | 描述                                                             |
| ---- | ---------------------------------------------------------------- |
| 输入 | username, password                                               |
| 处理 | 查询用户 → bcrypt.compare → 创建 session (24h 有效) → Set-Cookie |
| 输出 | 200 + { id, username, displayName, role }                        |
| 异常 | 401 用户名或密码错误                                             |

#### FR-AUTH-03: 获取当前用户

| 属性 | 描述                                      |
| ---- | ----------------------------------------- |
| 端点 | GET /api/auth/me                          |
| 处理 | 解析 cookie → 查询 session → 返回用户信息 |
| 输出 | 200 + { id, username, displayName, role } |
| 异常 | 401 未登录或 session 过期                 |

#### FR-AUTH-04: 登出

| 属性 | 描述                            |
| ---- | ------------------------------- |
| 端点 | POST /api/auth/logout           |
| 处理 | 删除 session 记录 → 清除 cookie |
| 输出 | 200                             |

---

### 3.2 FR-CHAT: AI 对话系统

#### FR-CHAT-01: 创建对话

| 属性 | 描述                                  |
| ---- | ------------------------------------- |
| 端点 | POST /api/chats                       |
| 输入 | agentId (可选), modelId (可选)        |
| 处理 | 创建 chat 记录，关联当前用户          |
| 输出 | 201 + { id, title, agentId, modelId } |

#### FR-CHAT-02: 发送消息（流式）

| 属性   | 描述                                               |
| ------ | -------------------------------------------------- |
| 端点   | POST /api/chat                                     |
| 输入   | { chatId, messages[], agentId, modelId }           |
| 处理   | 加载 Agent → 注入数据源 Tool → 调用 LLM → 流式返回 |
| 输出   | StreamResponse (text/event-stream)                 |
| 流格式 | Vercel AI SDK v6 data stream protocol              |

#### FR-CHAT-03: 聊天历史

| 属性 | 描述                                         |
| ---- | -------------------------------------------- |
| 端点 | GET /api/chats, GET /api/chats/[id]/messages |
| 处理 | 按 userId 过滤，按 createdAt 倒序            |
| 输出 | 200 + chat 列表 / message 列表               |

#### FR-CHAT-04: 多 Agent 选择

| Agent         | 能力                                 |
| ------------- | ------------------------------------ |
| chatAgent     | 通用对话 + 数据源查询                |
| researchAgent | 深度研究、多步推理                   |
| codeAgent     | 代码生成与解释                       |
| autoAgent     | 根据用户绑定数据源动态生成专属 Agent |

#### FR-CHAT-05: 图表渲染

| 属性     | 描述                                |
| -------- | ----------------------------------- |
| 触发     | Agent 返回 ```chart 代码块          |
| 处理     | 前端解析 chart block → 渲染 ECharts |
| 支持类型 | line, bar, pie, scatter, heatmap 等 |

---

### 3.3 FR-DS: 数据源管理

#### FR-DS-01: CRUD 操作

| 端点                            | 方法   | 描述                              |
| ------------------------------- | ------ | --------------------------------- |
| /api/datasources                | GET    | 列表（支持搜索、类型过滤）        |
| /api/datasources                | POST   | 创建数据源                        |
| /api/datasources/[id]           | GET    | 详情                              |
| /api/datasources/[id]           | PUT    | 更新                              |
| /api/datasources/[id]           | DELETE | 删除                              |
| /api/datasources/batch          | POST   | 批量操作（delete/enable/disable） |
| /api/datasources/[id]/duplicate | POST   | 复制                              |

#### FR-DS-02: 数据源类型与字段

| 类型    | 协议          | 特有配置                                     |
| ------- | ------------- | -------------------------------------------- |
| rest    | HTTP/HTTPS    | baseUrl, headers, auth (bearer/basic/apikey) |
| graphql | HTTP/HTTPS    | endpoint, headers, introspection             |
| grpc    | HTTP/2        | host, port, protoFile, tls                   |
| mqtt    | TCP/WebSocket | broker, port, topic, qos, clientId           |
| opcua   | OPC UA Binary | endpointUrl, securityMode, securityPolicy    |

#### FR-DS-03: 连接测试

| 属性 | 描述                                                                   |
| ---- | ---------------------------------------------------------------------- |
| 端点 | POST /api/datasources/[id]/test, POST /api/datasources/test-connection |
| 处理 | 根据协议类型调用对应 Adapter.testConnection()                          |
| 输出 | { success, message, latencyMs }                                        |
| 超时 | 10s                                                                    |

#### FR-DS-04: OpenAPI 导入

| 属性 | 描述                                                              |
| ---- | ----------------------------------------------------------------- |
| 端点 | POST /api/datasources/import-openapi                              |
| 输入 | { url } 或 { spec: OpenAPIObject }                                |
| 处理 | 解析 OpenAPI 3.x spec → 提取所有 path + method → 生成 endpoints[] |
| 输出 | 201 + 创建的数据源                                                |

#### FR-DS-05: GraphQL 内省

| 属性 | 描述                                                      |
| ---- | --------------------------------------------------------- |
| 端点 | POST /api/datasources/introspect-graphql                  |
| 输入 | { endpoint, headers? }                                    |
| 处理 | 发送 introspection query → 解析 schema → 生成 endpoints[] |
| 输出 | { queries[], mutations[] }                                |

#### FR-DS-06: Schema 发现

| 属性 | 描述                                       |
| ---- | ------------------------------------------ |
| 端点 | POST /api/datasources/[id]/discover-schema |
| 处理 | 调用端点获取样本数据 → 推断 JSON schema    |
| 输出 | { schema: JSONSchema }                     |

#### FR-DS-07: Agent 绑定

| 属性 | 描述                             |
| ---- | -------------------------------- |
| 端点 | PUT /api/datasources/[id]/agents |
| 输入 | { agentIds: string[] }           |
| 处理 | 更新 agent_datasources 关联表    |
| 输出 | 200                              |

---

### 3.4 FR-WIKI: 知识库系统

#### FR-WIKI-01: 文档上传

| 属性     | 描述                                   |
| -------- | -------------------------------------- |
| 端点     | POST /api/wiki/upload                  |
| 输入     | multipart/form-data (file)             |
| 支持格式 | .md, .txt, .pdf                        |
| 处理     | 存储文件 → 提取文本 → 创建异步摄入任务 |
| 输出     | 202 + { taskId }                       |

#### FR-WIKI-02: 页面管理

| 端点                         | 方法   | 描述                             |
| ---------------------------- | ------ | -------------------------------- |
| /api/wiki/pages              | GET    | 列表所有页面                     |
| /api/wiki/pages/[path]       | GET    | 获取单页内容（解析 frontmatter） |
| /api/wiki/admin/pages        | GET    | 管理员页面列表（含元数据）       |
| /api/wiki/admin/pages/[path] | DELETE | 删除页面                         |

#### FR-WIKI-03: 异步任务

| 属性     | 描述                                                             |
| -------- | ---------------------------------------------------------------- |
| 端点     | GET /api/wiki/admin/tasks, GET /api/wiki/admin/tasks/[id]/stream |
| 处理     | 任务队列管理，SSE 推送进度                                       |
| 状态流转 | pending → running → completed / failed                           |

#### FR-WIKI-04: 用户反馈

| 属性      | 描述                                                     |
| --------- | -------------------------------------------------------- |
| 端点      | POST /api/wiki/feedbacks                                 |
| 输入      | { pageId, type, content }                                |
| type 枚举 | correction（纠错）, addition（补充）, suggestion（建议） |
| 状态流转  | pending → approved / rejected                            |

#### FR-WIKI-05: 反馈管理（管理员）

| 端点                           | 方法  | 描述                                |
| ------------------------------ | ----- | ----------------------------------- |
| /api/wiki/admin/feedbacks      | GET   | 列表所有反馈                        |
| /api/wiki/admin/feedbacks/[id] | PATCH | 审核（approve/reject + reviewNote） |

---

### 3.5 FR-ADMIN: 管理后台

#### FR-ADMIN-01: 路由保护

| 属性 | 描述                  |
| ---- | --------------------- |
| 路径 | /admin/\*             |
| 条件 | 用户 role === "admin" |
| 行为 | 非管理员重定向到首页  |

#### FR-ADMIN-02: Agent 管理

| 属性 | 描述                                              |
| ---- | ------------------------------------------------- |
| 端点 | GET /api/agents, GET /api/agents/[id]/datasources |
| 功能 | 查看 Agent 列表、绑定的数据源                     |

---

## 4. 数据模型

### 4.1 ER 图

```
users 1──N sessions
users 1──N chats
users 1──N wiki_feedbacks
chats 1──N messages
datasources N──M agents (via agent_datasources)
```

### 4.2 表结构

#### users

| 字段          | 类型    | 约束                     | 说明           |
| ------------- | ------- | ------------------------ | -------------- |
| id            | TEXT    | PK                       | UUID           |
| username      | TEXT    | UNIQUE, NOT NULL         | 登录名         |
| display_name  | TEXT    | NOT NULL                 | 显示名         |
| password_hash | TEXT    | NOT NULL                 | bcrypt 哈希    |
| role          | TEXT    | NOT NULL, DEFAULT "user" | admin / user   |
| created_at    | INTEGER | NOT NULL                 | Unix timestamp |
| updated_at    | INTEGER | NOT NULL                 | Unix timestamp |

#### sessions

| 字段       | 类型    | 约束                   | 说明       |
| ---------- | ------- | ---------------------- | ---------- |
| id         | TEXT    | PK                     | Session ID |
| user_id    | TEXT    | FK → users.id, CASCADE | 所属用户   |
| expires_at | INTEGER | NOT NULL               | 过期时间   |
| created_at | INTEGER | NOT NULL               | 创建时间   |

#### datasources

| 字段              | 类型    | 约束                   | 说明                         |
| ----------------- | ------- | ---------------------- | ---------------------------- |
| id                | TEXT    | PK                     | UUID                         |
| name              | TEXT    | NOT NULL               | 数据源名称                   |
| description       | TEXT    | —                      | 描述                         |
| type              | TEXT    | NOT NULL               | rest/graphql/grpc/mqtt/opcua |
| auth              | TEXT    | NOT NULL               | JSON: 认证配置               |
| config            | TEXT    | NOT NULL               | JSON: 协议配置               |
| endpoints         | TEXT    | NOT NULL, DEFAULT "[]" | JSON: 端点列表               |
| enabled           | INTEGER | NOT NULL, DEFAULT 1    | 是否启用                     |
| last_tested_at    | INTEGER | —                      | 上次测试时间                 |
| last_test_result  | TEXT    | —                      | success/failure              |
| last_test_message | TEXT    | —                      | 测试详情                     |
| last_called_at    | INTEGER | —                      | 上次调用时间                 |
| call_count        | INTEGER | NOT NULL, DEFAULT 0    | 调用计数                     |
| created_at        | INTEGER | NOT NULL               | 创建时间                     |
| updated_at        | INTEGER | NOT NULL               | 更新时间                     |

#### agent_datasources

| 字段          | 类型    | 约束                                | 说明       |
| ------------- | ------- | ----------------------------------- | ---------- |
| agent_id      | TEXT    | PK (composite)                      | Agent 标识 |
| datasource_id | TEXT    | PK (composite), FK → datasources.id | 数据源     |
| created_at    | INTEGER | NOT NULL                            | 创建时间   |

#### chats

| 字段       | 类型    | 约束                          | 说明         |
| ---------- | ------- | ----------------------------- | ------------ |
| id         | TEXT    | PK                            | UUID         |
| title      | TEXT    | NOT NULL, DEFAULT "新对话"    | 对话标题     |
| agent_id   | TEXT    | NOT NULL, DEFAULT "chatAgent" | 使用的 Agent |
| model_id   | TEXT    | —                             | 使用的模型   |
| user_id    | TEXT    | FK → users.id, CASCADE        | 所属用户     |
| created_at | INTEGER | NOT NULL                      | 创建时间     |
| updated_at | INTEGER | NOT NULL                      | 更新时间     |

#### messages

| 字段       | 类型    | 约束                          | 说明                  |
| ---------- | ------- | ----------------------------- | --------------------- |
| id         | TEXT    | PK                            | UUID                  |
| chat_id    | TEXT    | FK → chats.id, CASCADE, INDEX | 所属对话              |
| role       | TEXT    | NOT NULL                      | user / assistant      |
| parts      | TEXT    | NOT NULL                      | JSON: UIMessage.parts |
| created_at | INTEGER | NOT NULL                      | 创建时间              |

#### wiki_feedbacks

| 字段        | 类型    | 约束                        | 说明                           |
| ----------- | ------- | --------------------------- | ------------------------------ |
| id          | TEXT    | PK                          | UUID                           |
| page_id     | TEXT    | NOT NULL                    | Wiki 页面路径                  |
| user_id     | TEXT    | FK → users.id, CASCADE      | 提交用户                       |
| type        | TEXT    | NOT NULL                    | correction/addition/suggestion |
| content     | TEXT    | NOT NULL                    | 反馈内容                       |
| status      | TEXT    | NOT NULL, DEFAULT "pending" | pending/approved/rejected      |
| review_note | TEXT    | —                           | 审核备注                       |
| reviewed_by | TEXT    | —                           | 审核人                         |
| reviewed_at | INTEGER | —                           | 审核时间                       |
| created_at  | INTEGER | NOT NULL                    | 创建时间                       |

---

## 5. API 接口规格

### 5.1 通用约定

| 项目     | 规范                           |
| -------- | ------------------------------ |
| 基础路径 | /api                           |
| 认证方式 | Cookie (session_id)            |
| 请求格式 | application/json (除文件上传)  |
| 响应格式 | application/json               |
| 错误格式 | { error: string }              |
| 分页     | ?page=1&pageSize=20 (部分接口) |

### 5.2 状态码

| 码  | 含义               |
| --- | ------------------ |
| 200 | 成功               |
| 201 | 创建成功           |
| 202 | 已接受（异步处理） |
| 400 | 参数错误           |
| 401 | 未认证             |
| 403 | 无权限             |
| 404 | 资源不存在         |
| 500 | 服务器错误         |

### 5.3 接口清单

| 模块       | 端点                                  | 方法           | 权限                   |
| ---------- | ------------------------------------- | -------------- | ---------------------- |
| Auth       | /api/auth/register                    | POST           | 公开                   |
| Auth       | /api/auth/login                       | POST           | 公开                   |
| Auth       | /api/auth/logout                      | POST           | 已登录                 |
| Auth       | /api/auth/me                          | GET            | 已登录                 |
| Chat       | /api/chat                             | POST           | 已登录                 |
| Chat       | /api/chats                            | GET/POST       | 已登录                 |
| Chat       | /api/chats/[id]                       | GET/DELETE     | 已登录(owner)          |
| Chat       | /api/chats/[id]/messages              | GET            | 已登录(owner)          |
| Datasource | /api/datasources                      | GET/POST       | GET=已登录, POST=admin |
| Datasource | /api/datasources/[id]                 | GET/PUT/DELETE | admin                  |
| Datasource | /api/datasources/[id]/test            | POST           | admin                  |
| Datasource | /api/datasources/[id]/discover-schema | POST           | admin                  |
| Datasource | /api/datasources/[id]/duplicate       | POST           | admin                  |
| Datasource | /api/datasources/[id]/agents          | GET/PUT        | admin                  |
| Datasource | /api/datasources/batch                | POST           | admin                  |
| Datasource | /api/datasources/test-connection      | POST           | admin                  |
| Datasource | /api/datasources/import-openapi       | POST           | admin                  |
| Datasource | /api/datasources/introspect-graphql   | POST           | admin                  |
| Agent      | /api/agents                           | GET            | admin                  |
| Agent      | /api/agents/[id]/datasources          | GET/PUT        | admin                  |
| Model      | /api/models                           | GET            | 已登录                 |
| Wiki       | /api/wiki/pages                       | GET            | 已登录                 |
| Wiki       | /api/wiki/pages/[path]                | GET            | 已登录                 |
| Wiki       | /api/wiki/feedbacks                   | POST           | 已登录                 |
| Wiki       | /api/wiki/upload                      | POST           | admin                  |
| Wiki       | /api/wiki/admin/pages                 | GET            | admin                  |
| Wiki       | /api/wiki/admin/pages/[path]          | DELETE         | admin                  |
| Wiki       | /api/wiki/admin/feedbacks             | GET            | admin                  |
| Wiki       | /api/wiki/admin/feedbacks/[id]        | PATCH          | admin                  |
| Wiki       | /api/wiki/admin/tasks                 | GET/POST       | admin                  |
| Wiki       | /api/wiki/admin/tasks/[id]            | GET            | admin                  |
| Wiki       | /api/wiki/admin/tasks/[id]/stream     | GET            | admin                  |

---

## 6. 非功能需求

### 6.1 NFR-PERF: 性能

| ID          | 需求              | 指标                    |
| ----------- | ----------------- | ----------------------- |
| NFR-PERF-01 | 页面首屏加载      | < 2s (Turbopack)        |
| NFR-PERF-02 | LLM 首 token 延迟 | < 1s (取决于 provider)  |
| NFR-PERF-03 | API CRUD 响应     | < 200ms                 |
| NFR-PERF-04 | SQLite 单次查询   | < 50ms                  |
| NFR-PERF-05 | 并发用户          | 单实例支撑 50+ 并发连接 |

### 6.2 NFR-SEC: 安全

| ID         | 需求       | 实现                                    |
| ---------- | ---------- | --------------------------------------- |
| NFR-SEC-01 | 密码存储   | bcrypt (cost=10)                        |
| NFR-SEC-02 | Session    | httpOnly + Secure + SameSite=Lax cookie |
| NFR-SEC-03 | API 密钥   | .env.local，不入版本控制                |
| NFR-SEC-04 | 数据源凭证 | DB 加密存储于 auth JSON 字段            |
| NFR-SEC-05 | 路由保护   | Middleware 统一拦截 + 角色校验          |
| NFR-SEC-06 | XSS 防护   | React 默认转义 + CSP headers            |
| NFR-SEC-07 | CSRF       | SameSite cookie + 同源检测              |

### 6.3 NFR-REL: 可靠性

| ID         | 需求           | 实现                            |
| ---------- | -------------- | ------------------------------- |
| NFR-REL-01 | 数据源调用重试 | 指数退避，最多 3 次             |
| NFR-REL-02 | 结构化错误     | 所有 API 返回 { error: string } |
| NFR-REL-03 | 流式中断恢复   | 前端检测断流，提示重新发送      |
| NFR-REL-04 | 数据备份       | SQLite 文件可直接拷贝           |

### 6.4 NFR-MAINT: 可维护性

| ID           | 需求     | 实现                                          |
| ------------ | -------- | --------------------------------------------- |
| NFR-MAINT-01 | 代码规范 | TypeScript strict, no semicolons              |
| NFR-MAINT-02 | 测试覆盖 | 单元测试 + 集成测试 (bun test)                |
| NFR-MAINT-03 | 文档     | PRD + SRS + 代码注释                          |
| NFR-MAINT-04 | 目录结构 | 按功能模块划分 (app/lib/components/db/mastra) |

### 6.5 NFR-EXT: 可扩展性

| ID         | 需求     | 实现                                      |
| ---------- | -------- | ----------------------------------------- |
| NFR-EXT-01 | 新协议   | 实现 Adapter 接口即可接入                 |
| NFR-EXT-02 | 新 Agent | Mastra agent 配置 + tools 绑定            |
| NFR-EXT-03 | 新 LLM   | models.ts 注册 provider + model           |
| NFR-EXT-04 | 跨平台   | Next.js static export → Tauri / Capacitor |

---

## 7. 接口设计

### 7.1 Adapter 接口

```typescript
interface DataSourceAdapter {
  type: DatasourceType
  testConnection(config: AdapterConfig): Promise<TestResult>
  query(endpoint: Endpoint, params?: Record<string, unknown>): Promise<QueryResult>
}

interface TestResult {
  success: boolean
  message: string
  latencyMs?: number
}

interface QueryResult {
  data: unknown
  metadata?: { latencyMs: number; source: string }
}
```

### 7.2 Agent Tool 接口

```typescript
// Mastra Tool 定义
const datasourceQueryTool = createTool({
  id: "datasource-query",
  description: "查询指定数据源的端点",
  inputSchema: z.object({
    datasourceId: z.string(),
    endpointId: z.string(),
    params: z.record(z.string(), z.unknown()).optional(),
  }),
  execute: async ({ context }) => {
    /* ... */
  },
})
```

### 7.3 流式响应协议

采用 Vercel AI SDK v6 Data Stream Protocol:

```
0:"text content chunk"
2:[{"type":"tool_call","toolCallId":"...","toolName":"...","args":{}}]
9:[{"type":"tool_result","toolCallId":"...","result":{}}]
d:{"finishReason":"stop"}
```

---

## 8. 部署与运维

### 8.1 部署要求

| 项目     | 要求                          |
| -------- | ----------------------------- |
| Node/Bun | Bun ≥ 1.1                     |
| 内存     | ≥ 512MB                       |
| 磁盘     | ≥ 1GB (含 SQLite + Wiki 文件) |
| 端口     | 3000 (默认)                   |

### 8.2 环境变量

| 变量                         | 必填 | 说明                                |
| ---------------------------- | ---- | ----------------------------------- |
| DEEPSEEK_API_KEY             | 是\* | DeepSeek API 密钥                   |
| OPENAI_API_KEY               | 否   | OpenAI API 密钥                     |
| ANTHROPIC_API_KEY            | 否   | Anthropic API 密钥                  |
| GOOGLE_GENERATIVE_AI_API_KEY | 否   | Google Gemini 密钥                  |
| DASHSCOPE_API_KEY            | 否   | 通义千问密钥                        |
| DATABASE_URL                 | 否   | SQLite 路径 (默认 data/xinsight.db) |

\*至少配置一个 LLM provider 密钥

### 8.3 启动命令

```bash
# 开发
bun dev

# 生产构建
bun run build
bun start
```

---

## 9. 约束与假设

### 9.1 约束

| 约束          | 影响                              |
| ------------- | --------------------------------- |
| SQLite 单写锁 | 高并发写场景受限，适合小团队      |
| LLM 外部依赖  | 核心 AI 功能需联网                |
| 本地文件存储  | Wiki 文件存本地，不适合多实例部署 |
| Bun 生态      | 部分 Node.js 包可能不完全兼容     |

### 9.2 假设

- 用户数 < 100，单实例部署
- LLM provider 可用率 > 99%
- 管理员负责数据源配置，普通用户仅使用对话
- 知识库文档以文本类为主 (Markdown/TXT/PDF)

---

## 10. 验收标准

### 10.1 功能验收

| 模块     | 验收条件                                   |
| -------- | ------------------------------------------ |
| 认证     | 注册/登录/登出/角色隔离正常                |
| 对话     | 流式响应、历史持久化、Agent 切换、模型切换 |
| 数据源   | CRUD + 5 种协议连接测试通过                |
| 知识库   | 上传/提取/检索/反馈/审核全流程             |
| 管理后台 | 仅 admin 可访问，功能完整                  |

### 10.2 非功能验收

| 项目   | 验收条件                                 |
| ------ | ---------------------------------------- |
| 性能   | 首屏 < 2s，API < 200ms                   |
| 安全   | 密码哈希存储，Session 正确过期，权限隔离 |
| 可靠性 | 错误友好展示，无白屏崩溃                 |

---

## 附录 A: 目录结构

```
xinsight/
├── docs/                   # 文档
│   ├── PRD.md             # 产品需求文档
│   └── SRS.md             # 本文档
├── src/
│   ├── app/               # Next.js App Router
│   │   ├── api/           # API Routes
│   │   ├── admin/         # 管理后台页面
│   │   ├── wiki/          # 知识库页面
│   │   └── ...            # 其他页面
│   ├── components/        # React 组件
│   ├── db/                # 数据库 schema + 迁移
│   ├── hooks/             # 自定义 Hooks
│   ├── lib/               # 工具库
│   │   ├── auth.ts        # 认证逻辑
│   │   ├── models.ts      # LLM 模型注册
│   │   ├── schema/        # Schema 推断
│   │   ├── importers/     # OpenAPI/GraphQL 导入
│   │   ├── cross-source/  # 跨源查询
│   │   ├── chart/         # 图表解析
│   │   └── wiki/          # 知识库逻辑
│   └── mastra/            # Mastra Agent + Tools
│       ├── agents/        # Agent 定义
│       └── tools/         # Tool 定义
├── wiki/                  # 知识库文件存储
├── data/                  # SQLite 数据库
└── package.json
```
