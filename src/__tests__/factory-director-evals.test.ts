import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"

const root = process.cwd()

describe("factoryDirectorAgent evals 配置", () => {
  const source = readFileSync(join(root, "src/mastra/agents/factory-director.ts"), "utf-8")

  it("导入 @mastra/evals 评估器", () => {
    expect(source).toContain("@mastra/evals/scorers/prebuilt")
  })

  it("配置 relevancy scorer", () => {
    expect(source).toContain("createAnswerRelevancyScorer")
    expect(source).toMatch(/relevancy:\s*\{/)
  })

  it("配置 toxicity scorer", () => {
    expect(source).toContain("createToxicityScorer")
    expect(source).toMatch(/toxicity:\s*\{/)
  })

  it("配置 hallucination scorer", () => {
    expect(source).toContain("createHallucinationScorer")
    expect(source).toMatch(/hallucination:\s*\{/)
  })

  it("所有 scorer 配置采样率", () => {
    const samplingMatches = source.match(/sampling:\s*\{/g) || []
    expect(samplingMatches.length).toBeGreaterThanOrEqual(3)
  })

  it("与 chatAgent 使用相同的 scorer 集合", () => {
    const chatSource = readFileSync(join(root, "src/mastra/agents/chat-agent.ts"), "utf-8")
    // 两个 Agent 应配置相同的三种 scorer
    for (const scorer of ["relevancy", "toxicity", "hallucination"]) {
      expect(source, `factory-director 应包含 ${scorer}`).toContain(scorer)
      expect(chatSource, `chat-agent 应包含 ${scorer}`).toContain(scorer)
    }
  })
})
