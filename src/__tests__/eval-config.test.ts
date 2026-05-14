import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock @mastra/evals/scorers/prebuilt
const mockRelevancy = vi.fn((_opts?: unknown) => "relevancy-scorer")
const mockToxicity = vi.fn((_opts?: unknown) => "toxicity-scorer")
const mockHallucination = vi.fn((_opts?: unknown) => "hallucination-scorer")
vi.mock("@mastra/evals/scorers/prebuilt", () => ({
  createAnswerRelevancyScorer: (opts: unknown) => mockRelevancy(opts),
  createToxicityScorer: (opts: unknown) => mockToxicity(opts),
  createHallucinationScorer: (opts: unknown) => mockHallucination(opts),
}))

describe("eval-config", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it("默认使用 deepseek/deepseek-chat 作为评估模型", async () => {
    delete process.env.EVAL_MODEL
    const { EVAL_MODEL } = await import("@/mastra/agents/eval-config")
    expect(EVAL_MODEL).toBe("deepseek/deepseek-chat")
  })

  it("可通过 EVAL_MODEL 环境变量覆盖", async () => {
    process.env.EVAL_MODEL = "openai/gpt-4o-mini"
    const { EVAL_MODEL } = await import("@/mastra/agents/eval-config")
    expect(EVAL_MODEL).toBe("openai/gpt-4o-mini")
    delete process.env.EVAL_MODEL
  })

  it("createDefaultScorers 返回三个 scorer", async () => {
    delete process.env.EVAL_MODEL
    const { createDefaultScorers } = await import("@/mastra/agents/eval-config")
    const scorers = createDefaultScorers()

    expect(scorers).toHaveProperty("relevancy")
    expect(scorers).toHaveProperty("toxicity")
    expect(scorers).toHaveProperty("hallucination")

    // 验证 sampling 配置
    expect(scorers.relevancy.sampling).toEqual({ type: "ratio", rate: 0.5 })
    expect(scorers.toxicity.sampling).toEqual({ type: "ratio", rate: 0.3 })
    expect(scorers.hallucination.sampling).toEqual({ type: "ratio", rate: 0.3 })

    // 验证使用了轻量模型
    expect(mockRelevancy).toHaveBeenCalledWith({ model: "deepseek/deepseek-chat" })
    expect(mockToxicity).toHaveBeenCalledWith({ model: "deepseek/deepseek-chat" })
    expect(mockHallucination).toHaveBeenCalledWith({ model: "deepseek/deepseek-chat" })
  })
})
