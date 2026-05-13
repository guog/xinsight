"use client"

import { useState, memo, useMemo } from "react"
import { Streamdown } from "streamdown"
import { cjk } from "@streamdown/cjk"
import { code } from "@streamdown/code"
import { math } from "@streamdown/math"
import { mermaid } from "@streamdown/mermaid"
import { Database, ChevronDown, ChevronRight, Brain, Users, MessageSquare } from "lucide-react"
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
import { cn } from "@/lib/utils"

const DEFAULT_AGENT = {
  name: "助手",
  role: "通用助手",
  avatar: "助",
  color: "text-muted-foreground",
  bgColor: "from-muted/40 to-muted/20",
  avatarBg: "bg-muted",
}

const streamdownPlugins = { cjk, code, math, mermaid }

interface AgentMessageProps {
  toolName: string
  state: "call" | "partial-call" | "result"
  args?: Record<string, unknown>
  result?: unknown
  /** 是否显示会议头部（首个 agent 委派才显示） */
  showMeetingHeader?: boolean
}

function isSupervisorDelegation(toolName: string): boolean {
  return toolName.startsWith("agent-")
}

function extractAgentResultText(result: unknown): string | null {
  if (!result || typeof result !== "object") return null
  const r = result as Record<string, unknown>
  if (typeof r.text === "string" && r.text.trim()) return r.text
  return null
}

function extractAgentReasoning(result: unknown): string | null {
  if (!result || typeof result !== "object") return null
  const r = result as Record<string, unknown>
  if (typeof r.reasoning === "string" && r.reasoning.trim()) return r.reasoning
  return null
}

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

function getDataSummary(data: unknown): string | null {
  if (!data || typeof data !== "object") return null
  const d = data as Record<string, unknown>
  if (Array.isArray(d.data)) return `${d.data.length}条记录`
  if (Array.isArray(d)) return `${d.length}条记录`
  if (typeof d.text === "string") return `${d.text.length}字回复`
  return null
}

function getRecordCount(data: unknown): number | null {
  if (!data || typeof data !== "object") return null
  const d = data as Record<string, unknown>
  if (Array.isArray(d.data)) return d.data.length
  if (Array.isArray(d)) return d.length
  return null
}

function getDataPreview(data: unknown): string | null {
  if (!data || typeof data !== "object") return null
  const d = data as Record<string, unknown>
  const arr = Array.isArray(d.data) ? d.data : Array.isArray(d) ? d : null
  if (!arr || arr.length === 0) return null
  const first = arr[0]
  if (!first || typeof first !== "object") return null
  const keys = Object.keys(first as Record<string, unknown>).slice(0, 3)
  return keys
    .map((k) => {
      const v = (first as Record<string, unknown>)[k]
      const val = typeof v === "string" ? v.slice(0, 20) : String(v)
      return `${k}: ${val}`
    })
    .join(" · ")
}

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

function formatToolName(toolName: string): string {
  return toolName
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .trim()
}

/* ─── 进行中动画（带步骤提示） ─── */
function TypingIndicator({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2 mb-1.5">
      <span className="text-xs text-muted-foreground/70">
        <span className="font-medium mr-1">{name}</span>正在深度思考 / 查询数据...
      </span>
      <span className="flex items-center gap-0.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1.5 rounded-full bg-muted-foreground/60 animate-bounce"
            style={{ animationDelay: `${i * 150}ms`, animationDuration: "0.8s" }}
          />
        ))}
      </span>
    </div>
  )
}

/* ─── 会议头部横幅 ─── */
function MeetingHeader() {
  return (
    <div className="flex items-center gap-3 py-3 mb-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800/60 dark:to-slate-900/40 border border-slate-200/60 dark:border-slate-700/40 shadow-sm">
        <Users className="size-3.5 text-slate-500 dark:text-slate-400" />
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
          🏭 专家研讨会
        </span>
      </div>
      <div className="flex-1 border-t border-dashed border-slate-300/50 dark:border-slate-600/50" />
    </div>
  )
}

/* ─── Supervisor 引导消息 ─── */
function SupervisorIntro({ text = "正在召集专家讨论..." }: { text?: string }) {
  return (
    <div className="flex items-start gap-3 pb-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 shadow-sm ring-2 ring-background">
        厂
      </div>
      <div className="flex items-center gap-2 mt-1.5">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">主管</span>
        <span className="text-xs text-muted-foreground/70">{text}</span>
      </div>
    </div>
  )
}

/* ─── 思考过程展示 ─── */
function ReasoningBlock({ reasoning }: { reasoning: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="mb-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground/70 hover:text-muted-foreground transition-colors"
      >
        <Brain className="size-3" />
        <span>思考过程</span>
        {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
      </button>
      <div
        className={cn(
          "grid transition-all duration-300 ease-in-out",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="mt-1.5 px-3 py-2 rounded-lg bg-muted/30 border border-border/30 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {reasoning}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── 可折叠数据源结果（增强版） ─── */
function CollapsibleToolResult({
  toolResult,
}: {
  toolResult: { toolName: string; result: unknown }
}) {
  const [open, setOpen] = useState(false)
  const toolInfo = TOOL_AGENT_MAP[toolResult.toolName]
  const summary = getDataSummary(toolResult.result)
  const recordCount = getRecordCount(toolResult.result)
  const preview = getDataPreview(toolResult.result)

  return (
    <div className="rounded-xl border border-border/40 bg-background/50 dark:bg-background/30 overflow-hidden shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-3 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
      >
        {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        <Database className="size-3 text-blue-500/70 dark:text-blue-400/70" />
        <span className="font-medium">{toolInfo?.toolLabel ?? toolResult.toolName}</span>
        {recordCount !== null && (
          <span className="ml-1 px-1.5 py-0.5 rounded-full bg-blue-100/80 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-[10px] font-medium tabular-nums">
            {recordCount}
          </span>
        )}
        {summary && (
          <span className="ml-auto text-muted-foreground/60 tabular-nums text-[11px]">
            {summary}
          </span>
        )}
      </button>

      {/* Mini data preview when collapsed */}
      {!open && preview && (
        <div className="px-3 pb-2 -mt-1">
          <div className="text-[10px] text-muted-foreground/50 font-mono truncate">{preview}</div>
        </div>
      )}

      <div
        className={cn(
          "grid transition-all duration-300 ease-in-out",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="px-3 pb-3 pt-1 border-t border-border/30">
            <pre className="text-xs bg-muted/20 dark:bg-muted/10 rounded-lg p-3 overflow-x-auto max-h-80 font-mono text-foreground/80 leading-relaxed">
              <code>{JSON.stringify(toolResult.result, null, 2)}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── 主组件 ─── */
export const AgentMessage = memo(function AgentMessage({
  toolName,
  state,
  args,
  result,
  showMeetingHeader,
}: AgentMessageProps) {
  if (isSupervisorDelegation(toolName)) {
    return (
      <DelegateAgentMessage
        toolName={toolName}
        state={state}
        args={args}
        result={result}
        showMeetingHeader={showMeetingHeader}
      />
    )
  }
  return <DirectToolMessage toolName={toolName} state={state} args={args} result={result} />
})

/* ─── 会议风格：子 Agent 发言气泡 ─── */
function DelegateAgentMessage({ toolName, state, result, showMeetingHeader }: AgentMessageProps) {
  const agentInfo = AGENT_MAP[toolName] ?? DEFAULT_AGENT
  const isDone = state === "result"
  const agentText = isDone ? extractAgentResultText(result) : null
  const agentReasoning = isDone ? extractAgentReasoning(result) : null
  const subToolResults = isDone ? extractSubAgentToolResults(result) : null

  return (
    <>
      {/* Meeting header + supervisor intro shown only for first delegation */}
      {showMeetingHeader !== false && (
        <>
          <MeetingHeader />
          <SupervisorIntro text={isDone ? "专家意见汇总完毕" : "正在召集专家讨论..."} />
        </>
      )}

      <div className="relative flex items-start gap-3 py-3 group animate-in fade-in slide-in-from-bottom-3 duration-500 fill-mode-backwards">
        {/* 时间线连接线 */}
        <div className="absolute left-[18px] top-12 bottom-0 w-px bg-gradient-to-b from-border/40 to-transparent group-last:hidden" />

        {/* 头像圆圈 */}
        <div
          className={cn(
            "relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold shadow-md ring-2 ring-background transition-transform duration-300 group-hover:scale-110",
            agentInfo.avatarBg,
            agentInfo.color,
          )}
        >
          {agentInfo.avatar}
        </div>

        {/* 发言内容 */}
        <div className="flex-1 min-w-0">
          {/* 名字 + 角色 */}
          <div className="flex items-center gap-2 mb-1.5">
            <MessageSquare className="size-3 text-muted-foreground/50" />
            <span className={cn("font-semibold text-sm", agentInfo.color)}>{agentInfo.name}</span>
            <span className="text-xs text-muted-foreground/60 italic">{agentInfo.role}</span>
          </div>

          {/* 气泡 + 三角指针 */}
          <div className="relative">
            {/* 三角指针 */}
            <div className="absolute left-[-6px] top-3 size-3 rotate-45 bg-gradient-to-br border-l border-b border-border/40 from-white/80 to-white/60 dark:from-slate-800/80 dark:to-slate-800/60" />

            <div
              className={cn(
                "relative rounded-2xl rounded-tl-md px-4 py-3 border border-border/40 shadow-sm transition-all duration-500",
                !isDone
                  ? "bg-gradient-to-br from-muted/60 via-muted/30 to-muted/60 animate-pulse"
                  : cn("bg-gradient-to-br shadow-md", agentInfo.bgColor),
              )}
            >
              {/* 进行中 → 打字指示器 */}
              {!isDone && <TypingIndicator name={agentInfo.name} />}

              {/* 思考过程 */}
              {isDone && agentReasoning && <ReasoningBlock reasoning={agentReasoning} />}

              {/* 完成 → Markdown 渲染 + 图表 */}
              {isDone &&
                agentText &&
                (() => {
                  const segments = parseChartBlocks(agentText)
                  return segments.map((seg, j) =>
                    seg.type === "chart" ? (
                      <ChartBlock key={`chart-${j}`} config={seg.config} />
                    ) : (
                      <div
                        key={`text-${j}`}
                        className="text-sm text-foreground/90 leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                      >
                        <Streamdown plugins={streamdownPlugins}>{seg.content}</Streamdown>
                      </div>
                    ),
                  )
                })()}

              {/* 无文本结果的兜底 */}
              {isDone && !agentText && (
                <span className="text-xs text-muted-foreground italic">（无回复内容）</span>
              )}
            </div>
          </div>

          {/* 数据源调用结果 — 可折叠 */}
          {isDone && subToolResults && subToolResults.length > 0 && (
            <div className="mt-2.5 space-y-2">
              {subToolResults.map((tr, idx) => (
                <CollapsibleToolResult key={idx} toolResult={tr} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

/* ─── 直接工具调用（非 Agent 委派） ─── */
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
            {summary && (
              <span className="text-xs text-muted-foreground mt-2 mb-2 inline-block">
                📊 摘要: {summary}
              </span>
            )}
            <ToolOutput output={result} />
          </>
        )}
      </ToolContent>
    </Tool>
  )
}
