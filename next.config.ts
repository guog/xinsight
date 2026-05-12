import type { NextConfig } from "next"

const isStaticExport = process.env.NEXT_BUILD_MODE === "static"

const nextConfig: NextConfig = {
  // 静态导出模式用于 Tauri 桌面端和 Capacitor 移动端
  ...(isStaticExport ? { output: "export" } : {}),
  // bun:sqlite 等 Bun 内置模块需要标记为外部依赖，避免 Turbopack 尝试打包
  serverExternalPackages: ["bun:sqlite"],
  // 第三方包（drizzle-orm, next, bun-types）有大量已知类型错误，跳过 build 时类型检查
  typescript: { ignoreBuildErrors: true },
}

export default nextConfig
