import { Agent } from "@mastra/core/agent"
import { DEFAULT_AGENT_MODEL } from "./model-config"
import { CHART_SYSTEM_PROMPT as DIRECTOR_CHART_PROMPT } from "@/lib/chart/prompt"
import { productionAgent } from "./production-agent"
import { qualityAgent } from "./quality-agent"
import { equipmentAgent } from "./equipment-agent"
import { warehouseAgent } from "./warehouse-agent"
import { energyAgent } from "./energy-agent"
import { wikiAgent } from "./wiki-agent"
import {
  createAnswerRelevancyScorer,
  createToxicityScorer,
  createHallucinationScorer,
} from "@mastra/evals/scorers/prebuilt"

/** 评估模型 — 使用与 Agent 相同的模型 */
const evalModel = DEFAULT_AGENT_MODEL

/**
 * 厂长 Supervisor Agent
 *
 * 统筹协调所有域子 Agent，根据用户问题智能委派给对应专员处理。
 * 支持跨域问题的多专员协调。
 */
export const factoryDirectorAgent = new Agent({
  id: "factory-director",
  name: "智能制造厂长",
  instructions: `你是西安基地智能制造工厂的厂长 AI 助手，负责统筹管理整个工厂的生产运营。

你管理以下专员团队：
- **生产管理专员**（productionAgent）：生产工单、排程、工艺路线、追溯、产线/工位/人员等基础数据
- **质量管理专员**（qualityAgent）：质量检验、缺陷分析、SPC、追溯
- **设备管理专员**（equipmentAgent）：设备状态、故障报警、维保、备件
- **仓储物流专员**（warehouseAgent）：库存、出入库、库位管理
- **能源管理专员**（energyAgent）：能耗数据、能源报警
- **知识库专员**（wikiAgent）：工厂知识库查询

委派策略：
1. 分析用户问题涉及的业务域
2. 委派给对应专员处理（可同时委派多个专员）
3. 汇总各专员的分析结果，给出厂长级的综合洞察

跨域问题处理：
- "本周生产状况" → 委派生产管理专员
- "良品率和设备故障" → 同时委派质量管理 + 设备管理
- "原材料库存够不够排产" → 同时委派仓储物流 + 生产管理
- "工厂整体运营" → 委派所有相关专员

回答规范：
- 使用中文回复
- 作为厂长给出全局视角的分析和建议
- 关键指标要有具体数字
- 发现问题时给出改进建议和优先级

${DIRECTOR_CHART_PROMPT}`,
  model: DEFAULT_AGENT_MODEL,
  agents: {
    productionAgent,
    qualityAgent,
    equipmentAgent,
    warehouseAgent,
    energyAgent,
    wikiAgent,
  },
  scorers: {
    relevancy: {
      scorer: createAnswerRelevancyScorer({ model: evalModel }),
      sampling: { type: "ratio", rate: 0.5 },
    },
    toxicity: {
      scorer: createToxicityScorer({ model: evalModel }),
      sampling: { type: "ratio", rate: 0.3 },
    },
    hallucination: {
      scorer: createHallucinationScorer({ model: evalModel }),
      sampling: { type: "ratio", rate: 0.3 },
    },
  },
})
