import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { WebSocket } from "ws"

// Mock DB
const mockSessionGet = vi.fn()
const mockUserGet = vi.fn()
const mockDeleteRun = vi.fn()
vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: (table: { id?: string }) => ({
        where: () => ({
          get: () => (table?.id === "id" ? mockSessionGet() : mockUserGet()),
        }),
      }),
    }),
    delete: () => ({
      where: () => ({
        run: mockDeleteRun,
      }),
    }),
  },
}))

vi.mock("@/db/schema", () => ({
  chats: {},
  messages: {},
  sessions: { id: "id" },
  users: { id: "userId" },
}))

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}))

// Mock mastra and voice dependencies
vi.mock("@/mastra", () => ({ mastra: { getAgent: vi.fn() } }))
vi.mock("@/lib/voice/dashscope-stt", () => ({ createSTTSession: vi.fn() }))
vi.mock("@/lib/voice/dashscope-tts", () => ({ createTTSSession: vi.fn() }))
vi.mock("@/lib/voice", () => ({ getVoiceConfig: vi.fn() }))
vi.mock("@mastra/ai-sdk", () => ({ toAISdkStream: vi.fn() }))
vi.mock("@ai-sdk/openai-compatible", () => ({ createOpenAICompatible: vi.fn() }))
vi.mock("@/lib/models", () => ({
  getProviderForModel: vi.fn(),
  getModelById: vi.fn(),
  getDefaultModelId: vi.fn(),
}))

describe("语音 WebSocket 认证", () => {
  let port: number
  let stopServer: () => Promise<void>

  beforeEach(async () => {
    vi.clearAllMocks()
    port = 13000 + Math.floor(Math.random() * 1000)
    process.env.VOICE_WS_PORT = String(port)
  })

  afterEach(async () => {
    if (stopServer) await stopServer()
  })

  it("无 cookie 连接被关闭（4001）", async () => {
    // 重置模块以获取新的 wss 实例
    vi.resetModules()
    const { startVoiceWebSocketServer, stopVoiceWebSocketServer } =
      await import("@/server/voice-ws")
    startVoiceWebSocketServer()
    stopServer = stopVoiceWebSocketServer

    const closeCode = await new Promise<number>((resolve) => {
      const ws = new WebSocket(`ws://localhost:${port}`)
      ws.on("close", (code) => resolve(code))
      ws.on("error", () => resolve(-1))
    })
    expect(closeCode).toBe(4001)
  })

  it("无效 session 连接被关闭（4001）", async () => {
    mockSessionGet.mockReturnValue(undefined)
    vi.resetModules()
    const { startVoiceWebSocketServer, stopVoiceWebSocketServer } =
      await import("@/server/voice-ws")
    startVoiceWebSocketServer()
    stopServer = stopVoiceWebSocketServer

    const closeCode = await new Promise<number>((resolve) => {
      const ws = new WebSocket(`ws://localhost:${port}`, {
        headers: { cookie: "xinsight_session=invalid-id" },
      })
      ws.on("close", (code) => resolve(code))
      ws.on("error", () => resolve(-1))
    })
    expect(closeCode).toBe(4001)
  })

  it("有效 session 连接保持打开", async () => {
    const futureDate = new Date(Date.now() + 86400000)
    mockSessionGet.mockReturnValue({ id: "s1", userId: "u1", expiresAt: futureDate })
    mockUserGet.mockReturnValue({ id: "u1", username: "test" })
    vi.resetModules()
    const { startVoiceWebSocketServer, stopVoiceWebSocketServer } =
      await import("@/server/voice-ws")
    startVoiceWebSocketServer()
    stopServer = stopVoiceWebSocketServer

    const isOpen = await new Promise<boolean>((resolve) => {
      const ws = new WebSocket(`ws://localhost:${port}`, {
        headers: { cookie: "xinsight_session=valid-session" },
      })
      ws.on("open", () => {
        resolve(ws.readyState === WebSocket.OPEN)
        ws.close()
      })
      ws.on("close", (code) => {
        if (code === 4001) resolve(false)
      })
      ws.on("error", () => resolve(false))
    })
    expect(isOpen).toBe(true)
  })
})
