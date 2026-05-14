import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"

const root = process.cwd()

describe("factoryDirectorAgent evals 配置", () => {
  const source = readFileSync(join(root, "src/mastra/agents/factory-director.ts"), "utf-8")
  const evalConfigSource = readFileSync(join(root, "src/mastra/agents/eval-config.ts"), "utf-8")

  it("导入共享 eval-config", () => {
    expect(source).toContain("./eval-config")
    expect(source).toContain("createDefaultScorers")
  })

  it("eval-config 导入 @mastra/evals 评估器", () => {
    expect(evalConfigSource).toContain("@mastra/evals/scorers/prebuilt")
  })

  it("eval-config 配置 relevancy scorer", () => {
    expect(evalConfigSource).toContain("createAnswerRelevancyScorer")
    expect(evalConfigSource).toContain("relevancy")
  })

  it("eval-config 配置 toxicity scorer", () => {
    expect(evalConfigSource).toContain("createToxicityScorer")
    expect(evalConfigSource).toContain("toxicity")
  })

  it("eval-config 配置 hallucination scorer", () => {
    expect(evalConfigSource).toContain("createHallucinationScorer")
    expect(evalConfigSource).toContain("hallucination")
  })

  it("与 chatAgent 使用相同的 scorer 集合（共享 eval-config）", () => {
    const chatSource = readFileSync(join(root, "src/mastra/agents/chat-agent.ts"), "utf-8")
    // 两个 Agent 都使用 createDefaultScorers
    expect(source).toContain("createDefaultScorers")
    expect(chatSource).toContain("createDefaultScorers")
  })
})
