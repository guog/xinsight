import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock 所有 Mastra 依赖
vi.mock("@mastra/core", () => ({
  Mastra: class {
    constructor() {}
  },
}))
vi.mock("@mastra/core/logger", () => ({
  ConsoleLogger: class {
    constructor() {}
  },
  createLogger: vi.fn(() => ({})),
}))

const mockMemoryConstructor = vi.fn()
vi.mock("@mastra/memory", () => ({
  Memory: class {
    constructor(opts: unknown) {
      mockMemoryConstructor(opts)
    }
  },
}))
vi.mock("@mastra/libsql", () => ({
  LibSQLStore: vi.fn(),
  LibSQLVector: vi.fn(),
}))
vi.mock("@mastra/fastembed", () => ({
  fastembed: {},
}))
vi.mock("@mastra/observability", () => ({
  Observability: vi.fn(),
  MastraStorageExporter: vi.fn(),
}))
vi.mock("@mastra/editor", () => ({
  MastraEditor: vi.fn(),
}))

// Mock 所有 Agent
vi.mock("@/mastra/agents/factory-director", () => ({ factoryDirectorAgent: {} }))
vi.mock("@/mastra/agents/production-agent", () => ({ productionAgent: {} }))
vi.mock("@/mastra/agents/quality-agent", () => ({ qualityAgent: {} }))
vi.mock("@/mastra/agents/equipment-agent", () => ({ equipmentAgent: {} }))
vi.mock("@/mastra/agents/warehouse-agent", () => ({ warehouseAgent: {} }))
vi.mock("@/mastra/agents/energy-agent", () => ({ energyAgent: {} }))
vi.mock("@/mastra/agents/wiki-agent", () => ({ wikiAgent: {} }))
vi.mock("@/mastra/agents/chat-agent", () => ({ chatAgent: {} }))
vi.mock("@/mastra/agents/auto-agent", () => ({ autoAgent: {} }))
vi.mock("@/mastra/agents/research-agent", () => ({ researchAgent: {} }))

describe("Mastra Memory lastMessages 配置", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it("默认 lastMessages 为 20", async () => {
    delete process.env.MASTRA_LAST_MESSAGES
    await import("@/mastra/index")

    expect(mockMemoryConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({ lastMessages: 20 }),
      }),
    )
  })

  it("MASTRA_LAST_MESSAGES 环境变量可覆盖", async () => {
    process.env.MASTRA_LAST_MESSAGES = "10"
    await import("@/mastra/index")

    expect(mockMemoryConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({ lastMessages: 10 }),
      }),
    )
    delete process.env.MASTRA_LAST_MESSAGES
  })
})
