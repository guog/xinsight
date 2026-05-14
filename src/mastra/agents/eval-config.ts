/**
 * 共享评估配置 — 统一 evalModel 和 scorer 工厂
 *
 * 使用轻量模型（deepseek-chat）降低评估成本，
 * 评估不需要最强模型，只需要稳定的判断能力。
 */
import {
  createAnswerRelevancyScorer,
  createToxicityScorer,
  createHallucinationScorer,
} from "@mastra/evals/scorers/prebuilt"

/**
 * 评估专用模型 — 默认使用 deepseek/deepseek-chat（便宜 & 够用）
 * 可通过 EVAL_MODEL 环境变量覆盖
 */
export const EVAL_MODEL = process.env.EVAL_MODEL || "deepseek/deepseek-chat"

/** 预配置的评估 scorers（所有 Agent 共享） */
export function createDefaultScorers() {
  return {
    relevancy: {
      scorer: createAnswerRelevancyScorer({ model: EVAL_MODEL }),
      sampling: { type: "ratio" as const, rate: 0.5 },
    },
    toxicity: {
      scorer: createToxicityScorer({ model: EVAL_MODEL }),
      sampling: { type: "ratio" as const, rate: 0.3 },
    },
    hallucination: {
      scorer: createHallucinationScorer({ model: EVAL_MODEL }),
      sampling: { type: "ratio" as const, rate: 0.3 },
    },
  }
}
