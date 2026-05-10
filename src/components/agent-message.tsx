"use client"

import { useState, useMemo } from "react"
import { Streamdown } from "streamdown"
import { cjk } from "@streamdown/cjk"
import { code } from "@streamdown/code"
import { math } from "@streamdown/math"
import {
  Loader2,
  Factory,
  FlaskConical,
  Wrench,
  Package,
  Zap,
  BookOpen,
  Database,
  MessageSquare,
  Route,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
  type ToolState,
} from "@/components/ai-elements/tool"
import { parseChartBlocks } from "@/lib/chart/parse-chart-block"
import { ChartBlock } from "@/components/chart/chart-block"

/**
 * Agent 信息映射：工具名 → 子 Agent 元数据
 * 用于在 UI 上呈现多 Agent 会议对话感
 */
const AGENT_MAP: Record<
  string,
  {
    name: string
    role: string
    icon: typeof Factory
    color: string
    bgColor: string
    avatarBg: string
  }
> = {
  // Supervisor 委派子 Agent 的 tool 名格式: agent-xxxAgent
  "agent-productionAgent": {
    name: "李工",
    role: "生产管理专员",
    icon: Factory,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "from-blue-50/80 to-blue-50/30 dark:from-blue-950/30 dark:to-blue-950/10",
    avatarBg: "bg-blue-100 dark:bg-blue-900/50",
  },
  "agent-qualityAgent": {
    name: "张工",
    role: "质量管理专员",
    icon: FlaskConical,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "from-emerald-50/80 to-emerald-50/30 dark:from-emerald-950/30 dark:to-emerald-950/10",
    avatarBg: "bg-emerald-100 dark:bg-emerald-900/50",
  },
  "agent-equipmentAgent": {
    name: "王工",
    role: "设备管理专员",
    icon: Wrench,
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "from-orange-50/80 to-orange-50/30 dark:from-orange-950/30 dark:to-orange-950/10",
    avatarBg: "bg-orange-100 dark:bg-orange-900/50",
  },
  "agent-warehouseAgent": {
    name: "赵工",
    role: "仓储物流专员",
    icon: Package,
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "from-purple-50/80 to-purple-50/30 dark:from-purple-950/30 dark:to-purple-950/10",
    avatarBg: "bg-purple-100 dark:bg-purple-900/50",
  },
  "agent-energyAgent": {
    name: "陈工",
    role: "能源管理专员",
    icon: Zap,
    color: "text-yellow-600 dark:text-yellow-400",
    bgColor: "from-yellow-50/80 to-yellow-50/30 dark:from-yellow-950/30 dark:to-yellow-950/10",
    avatarBg: "bg-yellow-100 dark:bg-yellow-900/50",
  },
  "agent-wikiAgent": {
    name: "孙工",
    role: "知识库专员",
    icon: BookOpen,
    color: "text-pink-600 dark:text-pink-400",
    bgColor: "from-pink-50/80 to-pink-50/30 dark:from-pink-950/30 dark:to-pink-950/10",
    avatarBg: "bg-pink-100 dark:bg-pink-900/50",
  },
}

/**
 * 工具名 → Agent 名映射（通过前缀匹配）
 */
const TOOL_AGENT_MAP: Record<string, { agentName: string; toolLabel: string }> = {
  queryProductionOrders: { agentName: "李工", toolLabel: "生产工单查询" },
  queryProductionSchedule: { agentName: "李工", toolLabel: "生产排程查询" },
  queryProcessRoute: { agentName: "李工", toolLabel: "工艺路线查询" },
  getProductionSummary: { agentName: "李工", toolLabel: "生产总览" },
  queryProductionLines: { agentName: "李工", toolLabel: "产线查询" },
  queryShiftsTeams: { agentName: "李工", toolLabel: "班组查询" },
  queryInspections: { agentName: "张工", toolLabel: "质检记录查询" },
  queryDefects: { agentName: "张工", toolLabel: "缺陷查询" },
  getQualitySummary: { agentName: "张工", toolLabel: "质量总览" },
  querySpcData: { agentName: "张工", toolLabel: "SPC 数据查询" },
  queryEquipment: { agentName: "王工", toolLabel: "设备查询" },
  queryMaintenance: { agentName: "王工", toolLabel: "维护记录查询" },
  queryAlarms: { agentName: "王工", toolLabel: "告警查询" },
  getEquipmentSummary: { agentName: "王工", toolLabel: "设备总览" },
  queryInventory: { agentName: "赵工", toolLabel: "库存查询" },
  queryInOutRecords: { agentName: "赵工", toolLabel: "出入库记录" },
  getInventoryAlerts: { agentName: "赵工", toolLabel: "库存预警" },
  queryEnergyConsumption: { agentName: "陈工", toolLabel: "能耗查询" },
  getEnergySummary: { agentName: "陈工", toolLabel: "能源总览" },
  queryEnergyAlarms: { agentName: "陈工", toolLabel: "能源告警" },
  traceProduct: { agentName: "李工", toolLabel: "产品追溯" },
  traceMaterial: { agentName: "李工", toolLabel: "物料追溯" },
  queryMaterials: { agentName: "李工", toolLabel: "物料查询" },
  wikiSearchTool: { agentName: "孙工", toolLabel: "知识库搜索" },
  wikiReadTool: { agentName: "孙工", toolLabel: "知识库阅读" },
  wikiListTool: { agentName: "孙工", toolLabel: "知识库列表" },
}

const DEFAULT_AGENT = {
  name: "助手",
  role: "通用助手",
  icon: Database,
  color: "text-muted-foreground",
  bgColor: "from-muted/40 to-muted/20",
  avatarBg: "bg-muted",
}

const streamdownPlugins = { cjk, code, math }

interface AgentMessageProps {
  toolName: string
  state: "call" | "partial-call" | "result"
  args?: Record<string, unknown>
  result?: unknown
}

/**
 * 判断是否为 Supervisor 委派子 Agent 的调用
 */
function isSupervisorDelegation(toolName: string): boolean {
  return toolName.startsWith("agent-")
}

/**
 * 从子 Agent 结果中提取有意义的文本
 */
function extractAgentResultText(result: unknown): string | null {
  if (!result || typeof result !== "object") return null
  const r = result as Record<string, unknown>
  if (typeof r.text === "string" && r.text.trim()) {
    return r.text
  }
  return null
}

/**
 * 从子 Agent 结果中提取数据源调用结果
 */
function extractSubAgentToolResults(
  result: unknown,
): Array<{ toolName: string; result: unknown }> | null {
  if (!result || typeof result !== "object") return null
  const r = result as Record<string, unknown>
  if (Array.isArray(r.subAgentToolResults) && r.subAgentToolResults.length > 0) {
    return r.subAgentToolResults as Array<{ toolName: string; result: unknown }>
  }
  return null
}

/**
 * 智能数据摘要
 */
function getDataSummary(data: unknown): string | null {
  if (!data || typeof data !== "object") return null
  const d = data as Record<string, unknown>
  if (Array.isArray(d.data)) return `${d.data.length} 条记录`
  if (Array.isArray(d)) return `${d.length} 条记录`
  if (typeof d.text === "string") return `${d.text.length} 字回复`
  return null
}

/**
 * 映射 AI SDK tool invocation state → Tool 组件 state
 */
function mapToolState(state: "call" | "partial-call" | "result"): ToolState {
  switch (state) {
    case "partial-call":
      return "input-streaming"
    case "call":
      return "input-available"
    case "result":
      return "output-available"
  }
}

export function AgentMessage({ toolName, state, args, result }: AgentMessageProps) {
  const isDelegate = isSupervisorDelegation(toolName)
  const isDone = state === "result"

  if (isDelegate) {
    return <DelegateAgentMessage toolName={toolName} state={state} args={args} result={result} />
  }

  // 非委派的直接工具调用 → 使用 Tool 组件
  return <DirectToolMessage toolName={toolName} state={state} args={args} result={result} />
}

/**
 * Supervisor 委派子 Agent — 会议对话风格
 */
function DelegateAgentMessage({ toolName, state, args, result }: AgentMessageProps) {
  const [showDetails, setShowDetails] = useState(false)
  const agentInfo = AGENT_MAP[toolName] ?? DEFAULT_AGENT
  const AgentIcon = agentInfo.icon
  const isDone = state === "result"
  const agentText = isDone ? extractAgentResultText(result) : null
  const subToolResults = isDone ? extractSubAgentToolResults(result) : null

  return (
    <div
      className={cn(
        "my-3 rounded-2xl border transition-all duration-300",
        "border-border/60 bg-gradient-to-r shadow-sm",
        agentInfo.bgColor,
      )}
    >
      {/* 头部：头像 + 角色名 + 状态 */}
      <div className="flex items-start gap-3 px-4 py-3">
        {/* 头像 */}
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full shadow-sm",
            agentInfo.avatarBg,
          )}
        >
          <AgentIcon className={cn("size-4.5", agentInfo.color)} />
        </div>

        {/* 内容区 */}
        <div className="flex-1 min-w-0">
          {/* 名字 + 角色 */}
          <div className="flex items-center gap-2 mb-1">
            <span className={cn("font-semibold text-sm", agentInfo.color)}>{agentInfo.name}</span>
            <span className="text-xs text-muted-foreground">{agentInfo.role}</span>
            {!isDone && <Loader2 className="size-3.5 text-muted-foreground animate-spin ml-auto" />}
          </div>

          {/* 发言内容 - 进行中 */}
          {!isDone && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MessageSquare className="size-3" />
              {args?.prompt
                ? `正在分析「${String(args.prompt).slice(0, 40)}${String(args.prompt).length > 40 ? "..." : ""}」...`
                : "正在分析问题..."}
            </div>
          )}

          {/* 子 Agent 回复文本 — Markdown 渲染 + 图表解析 */}
          {isDone &&
            agentText &&
            (() => {
              const segments = parseChartBlocks(
                agentText.length > 800 ? agentText.slice(0, 800) + "\n\n..." : agentText,
              )
              return segments.map((seg, j) =>
                seg.type === "chart" ? (
                  <ChartBlock key={`chart-${j}`} config={seg.config} />
                ) : (
                  <div
                    key={`text-${j}`}
                    className="text-sm text-foreground/90 leading-relaxed mt-1 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                  >
                    <Streamdown plugins={streamdownPlugins}>{seg.content}</Streamdown>
                  </div>
                ),
              )
            })()}
        </div>
      </div>

      {/* 数据源调用结果 — 可折叠 */}
      {isDone && subToolResults && subToolResults.length > 0 && (
        <div className="border-t border-border/30 px-4 py-2">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
          >
            <Database className="size-3" />
            <span>调用了 {subToolResults.length} 个数据源</span>
            <ChevronIcon open={showDetails} />
          </button>

          {showDetails && (
            <div className="mt-2 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
              {subToolResults.map((tr, idx) => {
                const toolInfo = TOOL_AGENT_MAP[tr.toolName]
                const summary = getDataSummary(tr.result)
                return (
                  <Tool key={idx}>
                    <ToolHeader
                      title={toolInfo?.toolLabel ?? tr.toolName}
                      state="output-available"
                      toolName={tr.toolName}
                    />
                    <ToolContent>
                      {summary && (
                        <span className="text-xs text-muted-foreground">📊 {summary}</span>
                      )}
                      <ToolOutput output={tr.result} />
                    </ToolContent>
                  </Tool>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * 直接工具调用（非 Agent 委派）— 使用 Tool 组件
 */
function DirectToolMessage({ toolName, state, args, result }: AgentMessageProps) {
  const toolInfo = TOOL_AGENT_MAP[toolName]
  const toolState = mapToolState(state)
  const summary = state === "result" ? getDataSummary(result) : null

  return (
    <Tool>
      <ToolHeader
        title={toolInfo?.toolLabel ?? formatToolName(toolName)}
        state={toolState}
        toolName={toolName}
      />
      <ToolContent>
        {args && Object.keys(args).length > 0 && <ToolInput input={args} />}
        {state === "result" && (
          <>
            {summary && <span className="text-xs text-muted-foreground">📊 {summary}</span>}
            <ToolOutput output={result} />
          </>
        )}
      </ToolContent>
    </Tool>
  )
}

function formatToolName(toolName: string): string {
  return toolName
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .trim()
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={cn("size-3.5 ml-auto transition-transform duration-200", open && "rotate-180")}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  )
}
