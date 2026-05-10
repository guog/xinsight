// Next.js instrumentation hook — 服务端启动时执行
// 用于启动语音 WebSocket 服务器等后台服务

export async function register() {
  // 仅在 Node.js 运行时中执行（排除 Edge）
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // 初始化数据库：迁移 + 种子数据
    const { initDatabase } = await import("@/db/init")
    await initDatabase()

    const { startVoiceWebSocketServer } = await import("@/server/voice-ws")
    startVoiceWebSocketServer()

    // 启动知识库子系统
    const { initWiki } = await import("@/lib/wiki/init")
    initWiki().catch((e) => console.error("[wiki] 初始化失败:", e))
  }
}
