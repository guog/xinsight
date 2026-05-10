"use client"

import { useState, useMemo } from "react"
import { Streamdown } from "streamdown"
import { cjk } from "@streamdown/cjk"
import { code } from "@streamdown/code"
import { math } from "@streamdown/math"
import {
  Loader2,
  ChevronDown,
  ChevronRight,
  Factory,
  FlaskConical,
  Wrench,
  Package,
  Zap,
  Route,
  BookOpen,
  Database,
  MessageSquare,
} from "lucide-react"
import { cn } from "@/lib/utils"

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
  // 直接工具调用（子 Agent 内部的工具调用）
  queryProductionOrders: {
    name: "李工",
    role: "生产管理专员",
    icon: Factory,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "from-blue-50/60 to-transparent dark:from-blue-950/20 dark:to-transparent",
    avatarBg: "bg-blue-100 dark:bg-blue-900/50",
  },
  queryProductionSchedule: {
    name: "李工",
    role: "生产管理专员",
    icon: Factory,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "from-blue-50/60 to-transparent dark:from-blue-950/20 dark:to-transparent",
    avatarBg: "bg-blue-100 dark:bg-blue-900/50",
  },
  queryProcessRoute: {
    name: "李工",
    role: "生产管理专员",
    icon: Factory,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "from-blue-50/60 to-transparent dark:from-blue-950/20 dark:to-transparent",
    avatarBg: "bg-blue-100 dark:bg-blue-900/50",
  },
  getProductionSummary: {
    name: "李工",
    role: "生产管理专员",
    icon: Factory,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "from-blue-50/60 to-transparent dark:from-blue-950/20 dark:to-transparent",
    avatarBg: "bg-blue-100 dark:bg-blue-900/50",
  },
  queryProductionLines: {
    name: "李工",
    role: "生产管理专员",
    icon: Factory,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "from-blue-50/60 to-transparent dark:from-blue-950/20 dark:to-transparent",
    avatarBg: "bg-blue-100 dark:bg-blue-900/50",
  },
  queryShiftsTeams: {
    name: "李工",
    role: "生产管理专员",
    icon: Factory,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "from-blue-50/60 to-transparent dark:from-blue-950/20 dark:to-transparent",
    avatarBg: "bg-blue-100 dark:bg-blue-900/50",
  },
  queryInspections: {
    name: "张工",
    role: "质量管理专员",
    icon: FlaskConical,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "from-emerald-50/60 to-transparent dark:from-emerald-950/20 dark:to-transparent",
    avatarBg: "bg-emerald-100 dark:bg-emerald-900/50",
  },
  queryDefects: {
    name: "张工",
    role: "质量管理专员",
    icon: FlaskConical,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "from-emerald-50/60 to-transparent dark:from-emerald-950/20 dark:to-transparent",
    avatarBg: "bg-emerald-100 dark:bg-emerald-900/50",
  },
  getQualitySummary: {
    name: "张工",
    role: "质量管理专员",
    icon: FlaskConical,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "from-emerald-50/60 to-transparent dark:from-emerald-950/20 dark:to-transparent",
    avatarBg: "bg-emerald-100 dark:bg-emerald-900/50",
  },
  querySpcData: {
    name: "张工",
    role: "质量管理专员",
    icon: FlaskConical,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "from-emerald-50/60 to-transparent dark:from-emerald-950/20 dark:to-transparent",
    avatarBg: "bg-emerald-100 dark:bg-emerald-900/50",
  },
  queryEquipment: {
    name: "王工",
    role: "设备管理专员",
    icon: Wrench,
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "from-orange-50/60 to-transparent dark:from-orange-950/20 dark:to-transparent",
    avatarBg: "bg-orange-100 dark:bg-orange-900/50",
  },
  queryMaintenance: {
    name: "王工",
    role: "设备管理专员",
    icon: Wrench,
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "from-orange-50/60 to-transparent dark:from-orange-950/20 dark:to-transparent",
    avatarBg: "bg-orange-100 dark:bg-orange-900/50",
  },
  queryAlarms: {
    name: "王工",
    role: "设备管理专员",
    icon: Wrench,
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "from-orange-50/60 to-transparent dark:from-orange-950/20 dark:to-transparent",
    avatarBg: "bg-orange-100 dark:bg-orange-900/50",
  },
  getEquipmentSummary: {
    name: "王工",
    role: "设备管理专员",
    icon: Wrench,
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "from-orange-50/60 to-transparent dark:from-orange-950/20 dark:to-transparent",
    avatarBg: "bg-orange-100 dark:bg-orange-900/50",
  },
  queryInventory: {
    name: "赵工",
    role: "仓储物流专员",
    icon: Package,
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "from-purple-50/60 to-transparent dark:from-purple-950/20 dark:to-transparent",
    avatarBg: "bg-purple-100 dark:bg-purple-900/50",
  },
  queryInOutRecords: {
    name: "赵工",
    role: "仓储物流专员",
    icon: Package,
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "from-purple-50/60 to-transparent dark:from-purple-950/20 dark:to-transparent",
    avatarBg: "bg-purple-100 dark:bg-purple-900/50",
  },
  getInventoryAlerts: {
    name: "赵工",
    role: "仓储物流专员",
    icon: Package,
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "from-purple-50/60 to-transparent dark:from-purple-950/20 dark:to-transparent",
    avatarBg: "bg-purple-100 dark:bg-purple-900/50",
  },
  queryEnergyConsumption: {
    name: "陈工",
    role: "能源管理专员",
    icon: Zap,
    color: "text-yellow-600 dark:text-yellow-400",
    bgColor: "from-yellow-50/60 to-transparent dark:from-yellow-950/20 dark:to-transparent",
    avatarBg: "bg-yellow-100 dark:bg-yellow-900/50",
  },
  getEnergySummary: {
    name: "陈工",
    role: "能源管理专员",
    icon: Zap,
    color: "text-yellow-600 dark:text-yellow-400",
    bgColor: "from-yellow-50/60 to-transparent dark:from-yellow-950/20 dark:to-transparent",
    avatarBg: "bg-yellow-100 dark:bg-yellow-900/50",
  },
  queryEnergyAlarms: {
    name: "陈工",
    role: "能源管理专员",
    icon: Zap,
    color: "text-yellow-600 dark:text-yellow-400",
    bgColor: "from-yellow-50/60 to-transparent dark:from-yellow-950/20 dark:to-transparent",
    avatarBg: "bg-yellow-100 dark:bg-yellow-900/50",
  },
  traceProduct: {
    name: "李工",
    role: "追溯管理",
    icon: Route,
    color: "text-cyan-600 dark:text-cyan-400",
    bgColor: "from-cyan-50/60 to-transparent dark:from-cyan-950/20 dark:to-transparent",
    avatarBg: "bg-cyan-100 dark:bg-cyan-900/50",
  },
  traceMaterial: {
    name: "李工",
    role: "追溯管理",
    icon: Route,
    color: "text-cyan-600 dark:text-cyan-400",
    bgColor: "from-cyan-50/60 to-transparent dark:from-cyan-950/20 dark:to-transparent",
    avatarBg: "bg-cyan-100 dark:bg-cyan-900/50",
  },
  queryMaterials: {
    name: "李工",
    role: "追溯管理",
    icon: Route,
    color: "text-cyan-600 dark:text-cyan-400",
    bgColor: "from-cyan-50/60 to-transparent dark:from-cyan-950/20 dark:to-transparent",
    avatarBg: "bg-cyan-100 dark:bg-cyan-900/50",
  },
  wikiSearchTool: {
    name: "孙工",
    role: "知识库专员",
    icon: BookOpen,
    color: "text-pink-600 dark:text-pink-400",
    bgColor: "from-pink-50/60 to-transparent dark:from-pink-950/20 dark:to-transparent",
    avatarBg: "bg-pink-100 dark:bg-pink-900/50",
  },
  wikiReadTool: {
    name: "孙工",
    role: "知识库专员",
    icon: BookOpen,
    color: "text-pink-600 dark:text-pink-400",
    bgColor: "from-pink-50/60 to-transparent dark:from-pink-950/20 dark:to-transparent",
    avatarBg: "bg-pink-100 dark:bg-pink-900/50",
  },
  wikiListTool: {
    name: "孙工",
    role: "知识库专员",
    icon: BookOpen,
    color: "text-pink-600 dark:text-pink-400",
    bgColor: "from-pink-50/60 to-transparent dark:from-pink-950/20 dark:to-transparent",
    avatarBg: "bg-pink-100 dark:bg-pink-900/50",
  },
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
 * 美化工具显示名
 */
function formatToolName(toolName: string): string {
  if (toolName.startsWith("agent-")) {
    return toolName.replace("agent-", "").replace("Agent", " 专员")
  }
  return toolName
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .trim()
}

/**
 * 智能数据预览：大 JSON 截断，显示摘要
 */
function DataPreview({ data }: { data: unknown }) {
  const [showFull, setShowFull] = useState(false)
  const text = useMemo(() => {
    if (typeof data === "string") return data
    return JSON.stringify(data, null, 2)
  }, [data])

  const isLarge = text.length > 3000
  const displayText = isLarge && !showFull ? text.slice(0, 3000) + "\n..." : text

  // 数组摘要
  const arraySummary = useMemo(() => {
    if (!data || typeof data !== "object") return null
    const d = data as Record<string, unknown>
    // 常见模式: { data: [...] } or { text: "...", subAgentToolResults: [...] }
    if (Array.isArray(d.data)) return `${d.data.length} 条记录`
    if (Array.isArray(d.subAgentToolResults)) return `${d.subAgentToolResults.length} 次数据源调用`
    if (typeof d.text === "string") return `${d.text.length} 字回复`
    return null
  }, [data])

  return (
    <div className="mt-1">
      {arraySummary && (
        <span className="text-xs text-muted-foreground/70 mb-1 block">📊 {arraySummary}</span>
      )}
      <pre className="text-xs bg-background/80 rounded-lg p-2.5 border border-border/30 font-mono overflow-x-auto max-h-64 overflow-y-auto">
        {displayText}
      </pre>
      {isLarge && !showFull && (
        <button
          onClick={() => setShowFull(true)}
          className="mt-1 text-xs text-primary/70 hover:text-primary transition-colors"
        >
          展开全部 ({(text.length / 1024).toFixed(1)} KB)
        </button>
      )}
    </div>
  )
}

export function AgentMessage({ toolName, state, args, result }: AgentMessageProps) {
  const [dataExpanded, setDataExpanded] = useState(false)
  const agentInfo = AGENT_MAP[toolName] ?? DEFAULT_AGENT
  const AgentIcon = agentInfo.icon
  const isDelegate = isSupervisorDelegation(toolName)
  const isDone = state === "result"
  const agentText = isDone ? extractAgentResultText(result) : null

  return (
    <div
      className={cn(
        "my-3 rounded-2xl border transition-all duration-300",
        isDelegate
          ? "border-border/60 bg-gradient-to-r shadow-sm"
          : "border-border/40 bg-gradient-to-r",
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

          {/* 发言内容 */}
          {!isDone && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MessageSquare className="size-3" />
              {isDelegate
                ? `正在分析 ${args?.prompt ? "「" + String(args.prompt).slice(0, 40) + (String(args.prompt).length > 40 ? "..." : "") + "」" : "问题"}...`
                : `正在查询 ${formatToolName(toolName)}...`}
            </div>
          )}

          {/* 子 Agent 回复文本 — Markdown 渲染 */}
          {isDone && agentText && isDelegate && (
            <div className="text-sm text-foreground/90 leading-relaxed mt-1 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
              <Streamdown plugins={streamdownPlugins}>
                {agentText.length > 500 ? agentText.slice(0, 500) + "\n\n..." : agentText}
              </Streamdown>
            </div>
          )}

          {/* 非委派的工具调用：简要显示 */}
          {isDone && !isDelegate && (
            <div className="text-xs text-muted-foreground mt-0.5">
              ✅ 已完成 {formatToolName(toolName)} 查询
            </div>
          )}
        </div>
      </div>

      {/* 可折叠的数据详情 */}
      {isDone && (
        <div className="border-t border-border/30">
          <button
            onClick={() => setDataExpanded(!dataExpanded)}
            className="flex items-center gap-1.5 w-full px-4 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
          >
            {dataExpanded ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
            <Database className="size-3" />
            查看原始数据
          </button>

          {dataExpanded && (
            <div className="px-4 pb-3 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
              {args && Object.keys(args).length > 0 && (
                <div>
                  <span className="text-xs font-medium text-muted-foreground">📤 请求参数</span>
                  <pre className="mt-1 text-xs bg-background/80 rounded-lg p-2.5 border border-border/30 font-mono overflow-x-auto max-h-32">
                    {JSON.stringify(args, null, 2)}
                  </pre>
                </div>
              )}
              <div>
                <span className="text-xs font-medium text-muted-foreground">📥 返回数据</span>
                <DataPreview data={result} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
