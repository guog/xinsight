import { sqliteTable, text, integer, primaryKey, index } from "drizzle-orm/sqlite-core"

export const datasources = sqliteTable("datasources", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull(),
  auth: text("auth").notNull(), // JSON string
  config: text("config").notNull(), // JSON string
  endpoints: text("endpoints").notNull().default("[]"), // JSON string - DatasourceEndpoint[]
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
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
  },
  (table) => [primaryKey({ columns: [table.agentId, table.datasourceId] })],
)

/** 聊天会话 */
export const chats = sqliteTable("chats", {
  id: text("id").primaryKey(),
  title: text("title").notNull().default("新对话"),
  agentId: text("agent_id").notNull().default("chatAgent"),
  modelId: text("model_id"),
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
