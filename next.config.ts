import type { NextConfig } from "next"

const isStaticExport = process.env.NEXT_BUILD_MODE === "static"

const nextConfig: NextConfig = {
  // 静态导出模式用于 Tauri 桌面端和 Capacitor 移动端
  ...(isStaticExport ? { output: "export" } : {}),
}

export default nextConfig
