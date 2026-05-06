"use client"

import { useState } from "react"
import {
  Loader2,
  CheckCircle2,
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
} from "lucide-react"

/**
 * 工具名 → 子 Agent 映射
 * 让用户直观感知多 Agent 协作
 */
const AGENT_MAP: Record<string, { name: string; icon: typeof Factory; color: string }> = {
  // 生产管理专员
  queryProductionOrders: { name: "生产管理专员", icon: Factory, color: "text-blue-500" },
  queryProductionSchedule: { name: "生产管理专员", icon: Factory, color: "text-blue-500" },
  queryProcessRoute: { name: "生产管理专员", icon: Factory, color: "text-blue-500" },
  getProductionSummary: { name: "生产管理专员", icon: Factory, color: "text-blue-500" },
  queryProductionLines: { name: "生产管理专员", icon: Factory, color: "text-blue-500" },
  queryShiftsTeams: { name: "生产管理专员", icon: Factory, color: "text-blue-500" },
  // 质量管理专员
  queryInspections: { name: "质量管理专员", icon: FlaskConical, color: "text-emerald-500" },
  queryDefects: { name: "质量管理专员", icon: FlaskConical, color: "text-emerald-500" },
  getQualitySummary: { name: "质量管理专员", icon: FlaskConical, color: "text-emerald-500" },
  querySpcData: { name: "质量管理专员", icon: FlaskConical, color: "text-emerald-500" },
  // 设备管理专员
  queryEquipment: { name: "设备管理专员", icon: Wrench, color: "text-orange-500" },
  queryMaintenance: { name: "设备管理专员", icon: Wrench, color: "text-orange-500" },
  queryAlarms: { name: "设备管理专员", icon: Wrench, color: "text-orange-500" },
  getEquipmentSummary: { name: "设备管理专员", icon: Wrench, color: "text-orange-500" },
  // 仓储物流专员
  queryInventory: { name: "仓储物流专员", icon: Package, color: "text-purple-500" },
  queryInOutRecords: { name: "仓储物流专员", icon: Package, color: "text-purple-500" },
  getInventoryAlerts: { name: "仓储物流专员", icon: Package, color: "text-purple-500" },
  // 能源管理专员
  queryEnergyConsumption: { name: "能源管理专员", icon: Zap, color: "text-yellow-500" },
  getEnergySummary: { name: "能源管理专员", icon: Zap, color: "text-yellow-500" },
  queryEnergyAlarms: { name: "能源管理专员", icon: Zap, color: "text-yellow-500" },
  // 追溯管理专员
  traceProduct: { name: "追溯管理专员", icon: Route, color: "text-cyan-500" },
  traceMaterial: { name: "追溯管理专员", icon: Route, color: "text-cyan-500" },
  queryMaterials: { name: "追溯管理专员", icon: Route, color: "text-cyan-500" },
  // 知识库专员
  wikiSearchTool: { name: "知识库专员", icon: BookOpen, color: "text-pink-500" },
  wikiReadTool: { name: "知识库专员", icon: BookOpen, color: "text-pink-500" },
  wikiListTool: { name: "知识库专员", icon: BookOpen, color: "text-pink-500" },
}

interface ToolInvocationProps {
  toolName: string
  state: "call" | "partial-call" | "result"
  args?: Record<string, unknown>
  result?: unknown
}

export function ToolInvocation({ toolName, state, args, result }: ToolInvocationProps) {
  const [expanded, setExpanded] = useState(false)

  const agentInfo = AGENT_MAP[toolName]
  const AgentIcon = agentInfo?.icon ?? Database
  const agentColor = agentInfo?.color ?? "text-muted-foreground"
  const agentName = agentInfo?.name ?? "助手"

  const displayName = toolName
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .trim()

  return (
    <div className="my-2 rounded-xl border border-border/50 bg-gradient-to-r from-muted/40 to-muted/20 text-sm backdrop-blur-sm transition-all duration-200 hover:border-border">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-3 py-2 hover:bg-muted/50 transition-all duration-200 rounded-xl"
      >
        {state === "result" ? (
          <CheckCircle2 className="size-4 text-green-500 drop-shadow-sm shrink-0" />
        ) : (
          <Loader2 className="size-4 text-primary animate-spin shrink-0" />
        )}
        <AgentIcon className={`size-3.5 shrink-0 ${agentColor}`} />
        <span className="flex-1 text-left">
          <span className={`font-medium ${agentColor}`}>{agentName}</span>
          <span className="text-muted-foreground">
            {state === "result" ? ` · 已查询 ${displayName}` : ` · 正在查询 ${displayName}...`}
          </span>
        </span>
        {state === "result" &&
          (expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />)}
      </button>

      {expanded && state === "result" && (
        <div className="px-3 pb-3 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
          {args && (
            <div>
              <span className="text-xs text-muted-foreground">参数:</span>
              <pre className="mt-1 text-xs bg-background/80 rounded-lg p-2.5 border border-border/30 font-mono overflow-x-auto max-h-32">
                {JSON.stringify(args, null, 2)}
              </pre>
            </div>
          )}
          <div>
            <span className="text-xs text-muted-foreground">结果:</span>
            <pre className="mt-1 text-xs bg-background/80 rounded-lg p-2.5 border border-border/30 font-mono overflow-x-auto max-h-48">
              {typeof result === "string" ? result : JSON.stringify(result, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
