import type { AgentRecord } from "@/db/repositories/agent-repository"

export interface WorkerDescriptor {
  id: string
  name: string
  description: string
  keywords: string[]
}

const BUILTIN_WORKERS: WorkerDescriptor[] = [
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
    keywords: ["质量", "检验", "缺陷", "SPC", "良品率", "不良", "合格"],
  },
  {
    id: "equipment-agent",
    name: "设备管理专员",
    description: "设备状态、故障报警、维保、备件",
    keywords: ["设备", "故障", "报警", "维保", "备件", "OEE", "停机"],
  },
  {
    id: "warehouse-agent",
    name: "仓储物流专员",
    description: "库存、出入库、库位管理",
    keywords: ["库存", "仓库", "出入库", "库位", "物料", "原材料"],
  },
  {
    id: "energy-agent",
    name: "能源管理专员",
    description: "能耗数据、能源报警",
    keywords: ["能耗", "能源", "用电", "水电", "电量"],
  },
  {
    id: "wiki-agent",
    name: "知识库专员",
    description: "工厂知识库查询",
    keywords: ["知识库", "文档", "wiki", "规范", "标准"],
  },
]

const CHAT_FALLBACK: WorkerDescriptor = {
  id: "chat-agent",
  name: "通用对话",
  description: "通用问答、闲聊、不涉及业务域的对话",
  keywords: [],
}

/**
 * 基于关键词的意图分类（快速本地路由，无需 LLM 调用）
 * 返回匹配的 Worker 列表，按相关度排序
 */
export function classifyIntent(query: string, workers: WorkerDescriptor[]): WorkerDescriptor[] {
  const q = query.toLowerCase()
  const scored: { worker: WorkerDescriptor; score: number }[] = []

  for (const w of workers) {
    if (w.keywords.length === 0) continue
    let score = 0
    for (const kw of w.keywords) {
      if (q.includes(kw.toLowerCase())) {
        score += kw.length
      }
    }
    if (score > 0) {
      scored.push({ worker: w, score })
    }
  }

  if (scored.length === 0) {
    const fallback = workers.find((w) => w.id === "chat-agent") || CHAT_FALLBACK
    return [fallback]
  }

  scored.sort((a, b) => b.score - a.score)
  return scored.map((s) => s.worker)
}

/**
 * 从 DB AgentRecord 构建 WorkerDescriptor 列表
 * 内置 agent 使用预定义的 keywords，自定义 agent 从 description 提取
 */
export function buildWorkerList(agents: AgentRecord[]): WorkerDescriptor[] {
  const builtinMap = new Map(BUILTIN_WORKERS.map((w) => [w.id, w]))

  return agents.map((a) => {
    const builtin = builtinMap.get(a.id)
    if (builtin) return builtin

    return {
      id: a.id,
      name: a.name,
      description: a.description || "",
      keywords: extractKeywords(a.description || ""),
    }
  })
}

function extractKeywords(description: string): string[] {
  // 中文分词：按标点和常见分隔符切分，取长度 >= 2 的词
  return description
    .split(/[，,、。；;：:\s/]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2)
}

/**
 * 构建 Supervisor 的 system prompt 中的 Worker 能力描述段落
 */
export function buildWorkerCapabilityPrompt(workers: WorkerDescriptor[]): string {
  const lines = workers
    .filter((w) => w.id !== "chat-agent")
    .map((w) => `- **${w.name}**（${w.id}）：${w.description}`)
  return lines.join("\n")
}

/**
 * 根据动态 Worker 列表生成 Supervisor 完整指令
 */
export function buildSupervisorInstructions(
  workers: WorkerDescriptor[],
  routingHint?: string,
  chartPrompt?: string,
): string {
  const workerSection = buildWorkerCapabilityPrompt(workers)

  const hintSection = routingHint
    ? `\n\n## 路由提示\n系统预判本次问题可能涉及以下专员，优先考虑委派：\n${routingHint}\n（你仍可根据实际语义调整委派目标）`
    : ""

  const chartSection = chartPrompt ? `\n\n${chartPrompt}` : ""

  return `你是西安基地智能制造工厂的厂长 AI 助手，负责统筹管理整个工厂的生产运营。

你管理以下专员团队：
${workerSection}

委派策略：
1. 分析用户问题涉及的业务域
2. **简单问题短路**：如果是简单问候、闲聊、通用知识问答（不涉及工厂业务数据），直接回答，无需委派子专员
3. 委派给对应专员处理（可同时委派多个专员）
4. 汇总各专员的分析结果，给出厂长级的综合洞察

跨域问题处理：
- 单域问题 → 委派对应专员
- 跨域问题 → 同时委派多个相关专员
- 全局概览 → 委派所有相关专员

指代消解：
- 用户说"它"、"这个"、"上面那个"等指代词时，结合对话历史确定实际指向
- 例如上一轮问了"A 产线产量"，本轮"它的良品率呢" → 委派质量专员查 A 产线

回答规范：
- 使用中文回复
- 作为厂长给出全局视角的分析和建议
- 关键指标要有具体数字
- 发现问题时给出改进建议和优先级${hintSection}${chartSection}`
}
