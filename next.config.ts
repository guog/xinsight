import type { NextConfig } from "next"
import { resolve } from "path"

const isStaticExport = process.env.NEXT_BUILD_MODE === "static"

const nextConfig: NextConfig = {
  // 静态导出模式用于 Tauri 桌面端和 Capacitor 移动端
  ...(isStaticExport ? { output: "export" } : {}),
  // bun:sqlite 等 Bun 内置模块需要标记为外部依赖，避免 Turbopack 尝试打包
  serverExternalPackages: [
    "bun:sqlite",
    "@anush008/tokenizers",
    "@mastra/fastembed",
    "fastembed",
    "shiki",
    "@shikijs/core",
    "@shikijs/engine-oniguruma",
    "@shikijs/engine-javascript",
  ],
}

export default nextConfig
