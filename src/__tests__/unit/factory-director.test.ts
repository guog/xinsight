import { describe, it, expect } from "vitest"
import { buildSupervisorInstructions } from "@/mastra/agents/supervisor-router"
import type { WorkerDescriptor } from "@/mastra/agents/supervisor-router"

const workers: WorkerDescriptor[] = [
  { id: "production-agent", name: "生产管理专员", description: "生产工单、排程", keywords: [] },
  { id: "quality-agent", name: "质量管理专员", description: "质量检验、缺陷分析", keywords: [] },
]

describe("buildSupervisorInstructions", () => {
  it("包含所有 Worker 能力描述", () => {
    const result = buildSupervisorInstructions(workers)
    expect(result).toContain("生产管理专员")
    expect(result).toContain("质量管理专员")
    expect(result).toContain("production-agent")
  })

  it("包含指代消解指令", () => {
    const result = buildSupervisorInstructions(workers)
    expect(result).toContain("指代消解")
  })

  it("包含路由提示（当提供时）", () => {
    const hint = "- **生产管理专员**（production-agent）"
    const result = buildSupervisorInstructions(workers, hint)
    expect(result).toContain("路由提示")
    expect(result).toContain(hint)
  })

  it("不包含路由提示（未提供时）", () => {
    const result = buildSupervisorInstructions(workers)
    expect(result).not.toContain("路由提示")
  })

  it("动态适应自定义 Agent", () => {
    const customWorkers = [
      ...workers,
      { id: "custom-agent", name: "自定义专员", description: "自定义业务", keywords: [] },
    ]
    const result = buildSupervisorInstructions(customWorkers)
    expect(result).toContain("自定义专员")
    expect(result).toContain("custom-agent")
  })
})
