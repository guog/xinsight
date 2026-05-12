/**
 * bun test preload: 在测试环境中将 DATABASE_URL 指向内存数据库。
 * 每个 worker 获得独立的内存 DB，消除并行测试的竞争条件。
 */
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = ":memory:"
}
