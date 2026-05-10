"use client"

import { useState } from "react"
import { Streamdown } from "streamdown"
import { cjk } from "@streamdown/cjk"
import { code } from "@streamdown/code"
import { math } from "@streamdown/math"
import { Loader2, Database, MessageSquare } from "lucide-react"
import { AGENT_MAP, TOOL_AGENT_MAP } from "@/config/agent-registry"
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
