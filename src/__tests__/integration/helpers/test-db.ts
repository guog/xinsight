/**
 * 集成测试用内存数据库
 * 使用 bun:sqlite + drizzle-orm/bun-sqlite（Bun 原生支持）
 */
import { Database } from "bun:sqlite"
import { drizzle } from "drizzle-orm/bun-sqlite"
import * as schema from "../../../db/schema"
import { SqliteDatasourceRepository } from "../../../db/repositories/datasource-repository"

/** 创建测试用内存数据库，返回 db 实例和 repo */
export function createTestDb() {
  const sqlite = new Database(":memory:")

  // 手动建表（drizzle-kit 不支持内存 DB push）
  sqlite.exec(`
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

    CREATE TABLE agent_datasources (
      agent_id TEXT NOT NULL,
      datasource_id TEXT NOT NULL REFERENCES datasources(id) ON DELETE CASCADE,
      endpoint_ids TEXT,
      confirmation_required_endpoints TEXT,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (agent_id, datasource_id)
    );
  `)

  const db = drizzle(sqlite, { schema })
  const repo = new SqliteDatasourceRepository(db)

  return { db, repo }
}
