import { sqliteTable, text, integer, primaryKey, index } from "drizzle-orm/sqlite-core"

/** 用户表 */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("user"), // "admin" | "user"
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
})

/** 会话表 */
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
})

export const datasources = sqliteTable("datasources", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull(),
  auth: text("auth").notNull(), // JSON string
  config: text("config").notNull(), // JSON string
  endpoints: text("endpoints").notNull().default("[]"), // JSON string - DatasourceEndpoint[]
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  lastTestedAt: integer("last_tested_at", { mode: "timestamp" }),
  lastTestResult: text("last_test_result"),
  lastTestMessage: text("last_test_message"),
  lastCalledAt: integer("last_called_at", { mode: "timestamp" }),
  callCount: integer("call_count").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
})

/** Agent 与数据源多对多关联 */
export const agentDatasources = sqliteTable(
  "agent_datasources",
  {
    agentId: text("agent_id").notNull(),
    datasourceId: text("datasource_id")
      .notNull()
      .references(() => datasources.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    endpointIds: text("endpoint_ids"), // JSON 字符串，允许访问的 endpoint ID 列表，null = 全部
  },
  (table) => [primaryKey({ columns: [table.agentId, table.datasourceId] })],
)

/** 聊天会话 */
export const chats = sqliteTable("chats", {
  id: text("id").primaryKey(),
  title: text("title").notNull().default("新对话"),
  agentId: text("agent_id").notNull().default("chatAgent"),
  modelId: text("model_id"),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
})

/** 聊天消息 */
export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    chatId: text("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // "user" | "assistant"
    parts: text("parts").notNull(), // JSON string - UIMessage.parts
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [index("idx_messages_chat_id").on(table.chatId)],
)

/** 知识库反馈 */
export const wikiFeedbacks = sqliteTable("wiki_feedbacks", {
  id: text("id").primaryKey(),
  pageId: text("page_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  content: text("content").notNull(),
  status: text("status").notNull().default("pending"),
  reviewNote: text("review_note"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: integer("reviewed_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
})

/** 知识库文件上传记录 */
export const wikiUploads = sqliteTable("wiki_uploads", {
  id: text("id").primaryKey(),
  originalName: text("original_name").notNull(),
  storedPath: text("stored_path").notNull().unique(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  sha256: text("sha256").notNull().unique(),
  status: text("status").notNull().default("pending"), // "pending" | "processing" | "done" | "failed" | "invalid"
  ingestTaskId: text("ingest_task_id"),
  ingestProgress: integer("ingest_progress").notNull().default(0),
  ingestError: text("ingest_error"),
  invalidReason: text("invalid_reason"),
  pagesCreated: text("pages_created"), // JSON string
  source: text("source").notNull().default("upload"),
  uploadedAt: integer("uploaded_at", { mode: "timestamp" }).notNull(),
  ingestedAt: integer("ingested_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
})

/** 知识库配置键值对 */
export const wikiSettings = sqliteTable("wiki_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
})

/** LLM 提供商配置 */
export const llmProviders = sqliteTable("llm_providers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull().default("cloud"), // "cloud" | "local"
  apiFormat: text("api_format").notNull().default("openai"), // "openai" | "ollama"
  baseUrl: text("base_url").notNull(),
  apiKey: text("api_key").notNull().default(""),
  apiKeyRequired: integer("api_key_required", { mode: "boolean" }).notNull().default(true),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  syncedAt: integer("synced_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
})

/** LLM 模型 */
export const llmModels = sqliteTable(
  "llm_models",
  {
    id: text("id").primaryKey(), // 格式: "providerId/modelSlug"
    providerId: text("provider_id")
      .notNull()
      .references(() => llmProviders.id, { onDelete: "cascade" }),
    modelSlug: text("model_slug").notNull(),
    name: text("name").notNull(), // 显示名称（可自定义）
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
    status: text("status").notNull().default("available"), // "available" | "deprecated" | "offline"
    capabilities: text("capabilities").notNull().default("{}"), // JSON: {chat,vision,tools}
    sortOrder: integer("sort_order").notNull().default(0),
    discoveredAt: integer("discovered_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [index("idx_llm_models_provider").on(table.providerId)],
)
