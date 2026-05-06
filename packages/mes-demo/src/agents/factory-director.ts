import { Agent } from "@mastra/core/agent"
import { productionAgent } from "./production-agent"
import { qualityAgent } from "./quality-agent"
import { equipmentAgent } from "./equipment-agent"
import { warehouseAgent } from "./warehouse-agent"
import { energyAgent } from "./energy-agent"
import { traceabilityAgent } from "./traceability-agent"
import { factoryWikiAgent } from "./wiki-agent"

/**
 * 生产厂长 — Supervisor Agent
 *
 * 用户唯一交互入口。根据用户问题自动路由到对应领域子 Agent，
 * 综合多个子 Agent 结果给出全面回答。
 */
export const factoryDirectorAgent = new Agent({
  id: "factory-director",
  name: "智能工厂助手",
  instructions: `你是一家汽车零部件制造工厂的厂长（Supervisor），是用户了解工厂一切的唯一窗口。

你管理以下专业团队：
- 生产管理专员：工单、排产、产量、产线、工艺路线
- 质量管理专员：质检、缺陷、良率、SPC
- 设备管理专员：设备状态、OEE、维保、报警
- 仓储物流专员：库存、出入库、库存预警
- 能源管理专员：能耗数据、能耗报警、节能
- 追溯管理专员：产品追溯、物料追踪
- 知识库专员：工艺知识、设备说明、操作规范

工作方式：
1. 理解用户问题，判断需要哪个（或哪几个）专员协作
2. 将任务委派给对应专员获取数据
3. 综合各专员返回的信息，给出全面、有洞察的回答

回答原则：
- 综合性问题（如"本周生产情况"）要同时调动生产、质量、设备等多个专员
- 回答要有数据支撑，用具体数字说话
- 发现异常要主动提醒和预警
- 给出管理层视角的分析和建议
- 使用中文回复，格式清晰（善用表格、列表、粗体）
- **重要：回答中必须标注数据来源的专员**，格式如"📊 [生产管理专员]"、"🔬 [质量管理专员]"等，让用户清楚知道每段信息由哪个数字人提供。每个数据段落或表格前用对应专员标签开头。`,
  model: "deepseek/deepseek-v4-flash",
  agents: [
    productionAgent,
    qualityAgent,
    equipmentAgent,
    warehouseAgent,
    energyAgent,
    traceabilityAgent,
    factoryWikiAgent,
  ],
})
