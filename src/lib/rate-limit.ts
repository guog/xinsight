import { db } from "@/db"
import { rateLimits } from "@/db/schema"
import { eq, and, gt } from "drizzle-orm"
import { sql } from "drizzle-orm"

/**
 * 基于 DB 的速率限制
 * 记录 IP + timestamp，查询窗口内请求数
 * 多实例/重启后状态不丢失
 */
export interface RateLimitConfig {
  /** 窗口时长（毫秒） */
  windowMs: number
  /** 窗口内最大请求数 */
  max: number
  /** 超限后锁定时长（毫秒） */
  lockoutMs: number
}

export const LOGIN_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60_000,
  max: 5,
  lockoutMs: 15 * 60_000,
}

/**
 * 检查是否被速率限制，并记录本次访问
 * @returns true 表示已超限，应拒绝请求
 */
export function checkRateLimit(
  ip: string,
  action: string,
  config: RateLimitConfig = LOGIN_RATE_LIMIT,
): boolean {
  const now = Date.now()

  // 先检查锁定期：如果窗口内已超限，判断最后一次超限记录后是否仍在锁定
  const windowStart = new Date(now - config.lockoutMs)
  const recentCount = db
    .select({ count: sql<number>`count(*)` })
    .from(rateLimits)
    .where(
      and(
        eq(rateLimits.ip, ip),
        eq(rateLimits.action, action),
        gt(rateLimits.createdAt, windowStart),
      ),
    )
    .get()

  if (recentCount && recentCount.count >= config.max) {
    return true
  }

  // 正常窗口检查
  const normalWindowStart = new Date(now - config.windowMs)
  const windowCount = db
    .select({ count: sql<number>`count(*)` })
    .from(rateLimits)
    .where(
      and(
        eq(rateLimits.ip, ip),
        eq(rateLimits.action, action),
        gt(rateLimits.createdAt, normalWindowStart),
      ),
    )
    .get()

  // 记录本次请求
  db.insert(rateLimits)
    .values({
      id: crypto.randomUUID(),
      ip,
      action,
      createdAt: new Date(now),
    })
    .run()

  if (windowCount && windowCount.count >= config.max) {
    return true
  }

  return false
}

/**
 * 清理过期的速率限制记录（可定期调用）
 */
export function cleanExpiredRateLimits(maxAgeMs = 30 * 60_000) {
  const cutoff = new Date(Date.now() - maxAgeMs)
  db.delete(rateLimits)
    .where(sql`${rateLimits.createdAt} < ${cutoff}`)
    .run()
}
