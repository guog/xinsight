import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock 外部依赖，避免真实初始化数据库
vi.mock("@mastra/libsql", () => {
  class MockLibSQLStore {
    id: string
    url: string
    constructor(config: Record<string, unknown>) {
      this.id = config.id as string
      this.url = config.url as string
    }
  }
  class MockLibSQLVector {
    id: string
    url: string
    constructor(config: Record<string, unknown>) {
      this.id = config.id as string
      this.url = config.url as string
    }
  }
  return { LibSQLStore: MockLibSQLStore, LibSQLVector: MockLibSQLVector }
})

vi.mock("@mastra/fastembed", () => ({
  fastembed: { doEmbed: vi.fn() },
}))

vi.mock("@mastra/observability", () => {
  class MockObservability {
    config: unknown
    constructor(config: unknown) {
      this.config = config
    }
  }
  class MockMastraStorageExporter {}
  return { Observability: MockObservability, MastraStorageExporter: MockMastraStorageExporter }
})

vi.mock("@mastra/editor", () => {
  class MockMastraEditor {}
  return { MastraEditor: MockMastraEditor }
})

vi.mock("@mastra/memory", () => {
  class MockMemory {
    config: unknown
    constructor(config: unknown) {
      MockMemory.lastConfig = config
      this.config = config
    }
    static lastConfig: unknown = null
  }
  return { Memory: MockMemory }
})

vi.mock("@mastra/core", () => {
  class MockMastra {
    config: Record<string, unknown>
    static lastConfig: Record<string, unknown> | null = null
    constructor(config: Record<string, unknown>) {
      this.config = config
      MockMastra.lastConfig = config
    }
  }
  return { Mastra: MockMastra }
})

vi.mock("@mastra/core/logger", () => ({
  ConsoleLogger: class {
    constructor() {}
  },
  createLogger: vi.fn().mockReturnValue({}),
}))

// Mock 所有 Agent 导入
vi.mock("../mastra/agents/factory-director", () => ({
  factoryDirectorAgent: { id: "factory-director" },
}))
vi.mock("../mastra/agents/production-agent", () => ({
  productionAgent: { id: "production-agent" },
}))
vi.mock("../mastra/agents/quality-agent", () => ({
  qualityAgent: { id: "quality-agent" },
}))
vi.mock("../mastra/agents/equipment-agent", () => ({
  equipmentAgent: { id: "equipment-agent" },
}))
vi.mock("../mastra/agents/warehouse-agent", () => ({
  warehouseAgent: { id: "warehouse-agent" },
}))
vi.mock("../mastra/agents/energy-agent", () => ({
  energyAgent: { id: "energy-agent" },
}))
vi.mock("../mastra/agents/wiki-agent", () => ({
  wikiAgent: { id: "wiki-agent" },
}))
vi.mock("../mastra/agents/chat-agent", () => ({
  chatAgent: { id: "chat-agent" },
}))
vi.mock("../mastra/agents/auto-agent", () => ({
  autoAgent: { id: "auto-agent" },
}))
vi.mock("../mastra/agents/research-agent", () => ({
  researchAgent: { id: "research-agent" },
}))

describe("Mastra 配置", () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    // 动态导入触发 Mastra 构造
    vi.resetModules()
  })

  it("应包含全局 storage 配置", async () => {
    const { Mastra } = await import("@mastra/core")
    await import("../mastra/index")
    const config = (Mastra as unknown as { lastConfig: Record<string, unknown> }).lastConfig
    expect(config).toBeDefined()
    expect(config.storage).toBeDefined()
  })

  it("应包含 observability 配置", async () => {
    const { Mastra } = await import("@mastra/core")
    await import("../mastra/index")
    const config = (Mastra as unknown as { lastConfig: Record<string, unknown> }).lastConfig
    expect(config.observability).toBeDefined()
  })

  it("应包含 10 个 Agent", async () => {
    const { Mastra } = await import("@mastra/core")
    await import("../mastra/index")
    const config = (Mastra as unknown as { lastConfig: Record<string, unknown> }).lastConfig
    const agents = config.agents as Record<string, unknown>
    expect(Object.keys(agents)).toHaveLength(10)
  })

  it("Memory 应启用 semanticRecall 和 workingMemory", async () => {
    const { Memory } = await import("@mastra/memory")
    await import("../mastra/index")
    const memoryConfig = (Memory as unknown as { lastConfig: Record<string, unknown> }).lastConfig
    const options = memoryConfig.options as Record<string, unknown>
    expect(options.semanticRecall).toBeDefined()
    expect(options.workingMemory).toBeDefined()
    expect((options.workingMemory as Record<string, unknown>).enabled).toBe(true)
    expect(options.observationalMemory).toBe(true)
  })

  it("Memory 应使用 LibSQLVector 和 fastembed", async () => {
    const { Memory } = await import("@mastra/memory")
    await import("../mastra/index")
    const memoryConfig = (Memory as unknown as { lastConfig: Record<string, unknown> }).lastConfig
    expect(memoryConfig.vector).toBeDefined()
    expect(memoryConfig.embedder).toBeDefined()
  })
})
