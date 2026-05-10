"use client"

import { useState } from "react"
import { Streamdown } from "streamdown"
import { cjk } from "@streamdown/cjk"
import { code } from "@streamdown/code"
import { math } from "@streamdown/math"
import { Database, ChevronDown, ChevronRight } from "lucide-react"
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

const streamdownPlugins = { cjk, code, math }

interface AgentMessageProps {
  toolName: string
  state: "call" | "partial-call" | "result"
  args?: Record<string, unknown>
  result?: unknown
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

/* ─── 打字动画指示器 ─── */
function TypingIndicator({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="text-sm text-muted-foreground">{name} 正在思考</span>
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

/* ─── 可折叠数据源结果 ─── */
function CollapsibleToolResult({
  toolResult,
}: {
  toolResult: { toolName: string; result: unknown }
}) {
  const [open, setOpen] = useState(false)
  const toolInfo = TOOL_AGENT_MAP[toolResult.toolName]
  const summary = getDataSummary(toolResult.result)

  return (
    <div className="rounded-lg border border-border/40 bg-background/50 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
      >
        {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        <Database className="size-3" />
        <span className="font-medium">{toolInfo?.toolLabel ?? toolResult.toolName}</span>
        {summary && (
          <span className="ml-auto text-muted-foreground/70 tabular-nums">{summary}</span>
        )}
      </button>

      <div
        className={cn(
          "grid transition-all duration-300 ease-in-out",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="px-3 pb-2 pt-1 border-t border-border/30">
            <Tool>
              <ToolContent>
                <ToolOutput output={toolResult.result} />
              </ToolContent>
            </Tool>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── 主组件 ─── */
export function AgentMessage({ toolName, state, args, result }: AgentMessageProps) {
  if (isSupervisorDelegation(toolName)) {
    return <DelegateAgentMessage toolName={toolName} state={state} args={args} result={result} />
  }
  return <DirectToolMessage toolName={toolName} state={state} args={args} result={result} />
}

/* ─── 会议风格：子 Agent 发言气泡 ─── */
function DelegateAgentMessage({ toolName, state, result }: AgentMessageProps) {
  const agentInfo = AGENT_MAP[toolName] ?? DEFAULT_AGENT
  const isDone = state === "result"
  const agentText = isDone ? extractAgentResultText(result) : null
  const subToolResults = isDone ? extractSubAgentToolResults(result) : null

  return (
    <div className="relative flex items-start gap-3 py-3 group">
      {/* 时间线连接线 */}
      <div className="absolute left-[18px] top-12 bottom-0 w-px bg-border/40 group-last:hidden" />

      {/* 头像圆圈 */}
      <div
        className={cn(
          "relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold shadow-sm ring-2 ring-background",
          agentInfo.avatarBg,
          agentInfo.color,
        )}
      >
        {agentInfo.avatar}
      </div>

      {/* 发言内容 */}
      <div className="flex-1 min-w-0">
        {/* 名字 + 角色 */}
        <div className="flex items-center gap-2 mb-1">
          <span className={cn("font-semibold text-sm", agentInfo.color)}>{agentInfo.name}</span>
          <span className="text-xs text-muted-foreground/70">{agentInfo.role}</span>
        </div>

        {/* 气泡 */}
        <div
          className={cn(
            "rounded-2xl rounded-tl-md px-4 py-3 bg-gradient-to-br border border-border/40 shadow-sm",
            agentInfo.bgColor,
          )}
        >
          {/* 进行中 → 打字指示器 */}
          {!isDone && <TypingIndicator name={agentInfo.name} />}

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

        {/* 数据源调用结果 — 可折叠 */}
        {isDone && subToolResults && subToolResults.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {subToolResults.map((tr, idx) => (
              <CollapsibleToolResult key={idx} toolResult={tr} />
            ))}
          </div>
        )}
      </div>
    </div>
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
            {summary && <span className="text-xs text-muted-foreground">📊 {summary}</span>}
            <ToolOutput output={result} />
          </>
        )}
      </ToolContent>
    </Tool>
  )
}
