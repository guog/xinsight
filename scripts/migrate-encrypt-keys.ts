/**
 * 迁移脚本：将数据库中明文存储的 apiKey 加密
 * 用法：bun scripts/migrate-encrypt-keys.ts
 */
import { db } from "@/db"
import { llmProviders } from "@/db/schema"
import { eq } from "drizzle-orm"
import { encrypt, decrypt } from "@/lib/crypto"

async function main() {
  const providers = db.select().from(llmProviders).all()
  let migrated = 0
  let skipped = 0

  for (const p of providers) {
    if (!p.apiKey) {
      skipped++
      continue
    }

    // 尝试解密，如果成功说明已加密
    try {
      decrypt(p.apiKey)
      skipped++
      console.log(`[跳过] ${p.id} — 已加密`)
    } catch {
      // 解密失败说明是明文，需要加密
      const encrypted = encrypt(p.apiKey)
      await db
        .update(llmProviders)
        .set({ apiKey: encrypted, updatedAt: new Date() })
        .where(eq(llmProviders.id, p.id))
      migrated++
      console.log(`[迁移] ${p.id} — 已加密`)
    }
  }

  console.log(`\n完成：迁移 ${migrated} 条，跳过 ${skipped} 条`)
}

main().catch(console.error)
