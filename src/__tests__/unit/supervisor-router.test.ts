import { describe, it, expect } from "vitest"
import {
  classifyIntent,
  buildWorkerList,
  type WorkerDescriptor,
} from "@/mastra/agents/supervisor-router"

const workers: WorkerDescriptor[] = [
  {
    id: "production-agent",
    name: "生产管理专员",
    description: "生产工单、排程、工艺路线、追溯、产线/工位/人员等基础数据",
    keywords: ["生产", "工单", "排程", "排产", "工艺", "追溯", "产线", "工位", "产量"],
  },
  {
    id: "quality-agent",
    name: "质量管理专员",
    description: "质量检验、缺陷分析、SPC、良品率",
    keywords: ["质量", "检验", "缺陷", "SPC", "良品率", "不良"],
  },
  {
    id: "equipment-agent",
    name: "设备管理专员",
    description: "设备状态、故障报警、维保、备件",
    keywords: ["设备", "故障", "报警", "维保", "备件", "OEE"],
  },
  {
    id: "warehouse-agent",
    name: "仓储物流专员",
    description: "库存、出入库、库位管理",
    keywords: ["库存", "仓库", "出入库", "库位", "物料"],
  },
  {
    id: "energy-agent",
    name: "能源管理专员",
    description: "能耗数据、能源报警",
    keywords: ["能耗", "能源", "用电", "水电"],
  },
  {
    id: "wiki-agent",
    name: "知识库专员",
    description: "工厂知识库查询",
    keywords: ["知识库", "文档", "wiki", "规范", "标准"],
  },
  {
    id: "chat-agent",
    name: "通用对话",
    description: "通用问答、闲聊、不涉及业务域的对话",
    keywords: [],
  },
]

describe("classifyIntent", () => {
  const cases: [string, string[]][] = [
    // 单域路由
    ["今天有多少生产工单？", ["production-agent"]],
    ["查一下 A 产线的排程", ["production-agent"]],
    ["本周良品率多少？", ["quality-agent"]],
    ["设备故障报警有哪些？", ["equipment-agent"]],
    ["原材料库存够不够？", ["warehouse-agent"]],
    ["本月能耗趋势怎么样？", ["energy-agent"]],
    ["帮我查一下焊接工艺规范", ["wiki-agent"]],
    // 多域路由
    ["良品率和设备故障有关系吗？", ["quality-agent", "equipment-agent"]],
    ["原材料库存够不够排产？", ["warehouse-agent", "production-agent"]],
    // 兜底
    ["你好", ["chat-agent"]],
    ["今天天气怎么样", ["chat-agent"]],
    ["帮我写一首诗", ["chat-agent"]],
  ]

  it.each(cases)("「%s」→ %j", (query, expectedAgents) => {
    const result = classifyIntent(query, workers)
    // 至少匹配第一个预期 agent
    expect(result.map((r) => r.id)).toEqual(expect.arrayContaining(expectedAgents))
  })

  it("路由准确率 > 95%", () => {
    let correct = 0
    for (const [query, expected] of cases) {
      const result = classifyIntent(query, workers)
      const resultIds = result.map((r) => r.id)
      if (expected.every((e) => resultIds.includes(e))) {
        correct++
      }
    }
    const accuracy = correct / cases.length
    expect(accuracy).toBeGreaterThan(0.95)
  })
})

describe("buildWorkerList", () => {
  it("根据 agent 记录构建 WorkerDescriptor 列表", () => {
    const agents = [
      {
        id: "test-agent",
        name: "测试专员",
        description: "负责测试相关",
        systemPrompt: "你是测试专员",
        modelId: null,
        icon: null,
        isBuiltin: false,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]
    const result = buildWorkerList(agents)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe("test-agent")
    expect(result[0].name).toBe("测试专员")
    expect(result[0].description).toBe("负责测试相关")
  })
})
