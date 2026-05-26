"use client"

import { useState, memo, useMemo, useEffect, useCallback } from "react"
import { Streamdown } from "streamdown"
import { cjk } from "@streamdown/cjk"
import { code } from "@streamdown/code"
import { math } from "@streamdown/math"
import { mermaid } from "@streamdown/mermaid"
import { Database, ChevronDown, ChevronRight, Brain, CheckCircle2, AlertCircle } from "lucide-react"
import { useAgentStreamingText } from "@/hooks/use-agent-progress"
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

/* ─── 全局注入心跳动画（仅一次） ─── */
let heartbeatInjected = false
function ensureHeartbeatStyle() {
  if (heartbeatInjected || typeof document === "undefined") return
  heartbeatInjected = true
  const style = document.createElement("style")
  style.textContent = `
@keyframes agent-heartbeat {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.15); }
}`
  document.head.appendChild(style)
}

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
  /** 用于匹配子 Agent 流式进度的 toolCallId */
  toolCallId?: string
  /** 已废弃，保留兼容 */
  showMeetingHeader?: boolean
  className?: string
  submitToolOutputs?: (toolOutputs: { toolCallId: string; output: any }[]) => Promise<any>
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

function extractAgentError(result: unknown): string | null {
  if (!result || typeof result !== "object") return null
  const r = result as Record<string, unknown>
  if (typeof r.error === "string" && r.error.trim()) return r.error
  if (typeof r.text === "string" && /^(错误|error|failed|失败)/i.test(r.text.trim())) return r.text
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

/* ─── Google 风格旋转彩色光圈头像 + 心跳动画 ─── */
const AgentAvatar = memo(function AgentAvatar({
  avatar,
  avatarBg,
  color,
  isProcessing,
}: {
  avatar: string
  avatarBg: string
  color: string
  isProcessing: boolean
}) {
  useEffect(() => {
    if (isProcessing) ensureHeartbeatStyle()
  }, [isProcessing])

  return (
    <div className="relative flex-shrink-0">
      {/* 旋转彩虹光圈 */}
      {isProcessing && (
        <div
          className="absolute -inset-[3px] rounded-full animate-spin"
          style={{
            background: "conic-gradient(from 0deg, #4285f4, #ea4335, #fbbc04, #34a853, #4285f4)",
            animationDuration: "1.5s",
          }}
        />
      )}
      {/* 白色间隔环 */}
      {isProcessing && <div className="absolute -inset-[1px] rounded-full bg-background" />}
      {/* 头像 */}
      <div
        className={cn(
          "relative z-10 flex size-8 items-center justify-center rounded-full text-xs font-bold transition-transform duration-300",
          avatarBg,
          color,
        )}
        style={
          isProcessing ? { animation: "agent-heartbeat 1.2s ease-in-out infinite" } : undefined
        }
      >
        {avatar}
      </div>
    </div>
  )
})

/* ─── 思考过程展示 ─── */
const ReasoningBlock = memo(function ReasoningBlock({ reasoning }: { reasoning: string }) {
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
      {open && (
        <div className="mt-1.5 px-3 py-2 rounded-lg bg-muted/30 border border-border/30 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
          {reasoning}
        </div>
      )}
    </div>
  )
})

/* ─── 可折叠数据源结果 ─── */
const CollapsibleToolResult = memo(function CollapsibleToolResult({
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

      {!open && preview && (
        <div className="px-3 pb-2 -mt-1">
          <div className="text-[10px] text-muted-foreground/50 font-mono truncate">{preview}</div>
        </div>
      )}

      {/* 仅展开时渲染 JSON */}
      {open && (
        <div className="px-3 pb-3 pt-1 border-t border-border/30">
          <pre className="text-xs bg-muted/20 dark:bg-muted/10 rounded-lg p-3 overflow-x-auto max-h-80 font-mono text-foreground/80 leading-relaxed">
            <code>{JSON.stringify(toolResult.result, null, 2)}</code>
          </pre>
        </div>
      )}
    </div>
  )
})

/* ─── 主组件 ─── */
export function AgentMessage({
  toolName,
  state,
  args,
  result,
  toolCallId,
  showMeetingHeader,
  className,
  submitToolOutputs,
}: AgentMessageProps) {
  if (isSupervisorDelegation(toolName)) {
    return (
      <DelegateAgentMessage
        toolName={toolName}
        state={state}
        args={args}
        result={result}
        toolCallId={toolCallId}
        className={className}
      />
    )
  }

  return (
    <DirectToolMessage
      toolName={toolName}
      state={state}
      args={args}
      result={result}
      toolCallId={toolCallId}
      className={className}
      submitToolOutputs={submitToolOutputs}
    />
  )
}

/* ─── 状态图标（仅 done / error） ─── */
const AgentStatusIcon = memo(function AgentStatusIcon({ status }: { status: "done" | "error" }) {
  switch (status) {
    case "done":
      return <CheckCircle2 className="size-3.5 text-emerald-500" />
    case "error":
      return <AlertCircle className="size-3.5 text-red-500" />
  }
})

/* ─── 折叠内容（懒渲染，展开后才挂载重组件） ─── */
const DelegateContent = memo(function DelegateContent({
  agentText,
  agentReasoning,
  agentError,
  subToolResults,
  isProcessing,
  toolCallId,
  args,
}: {
  agentText: string | null
  agentReasoning: string | null
  agentError: string | null
  subToolResults: Array<{ toolName: string; result: unknown }> | null
  isProcessing: boolean
  toolCallId?: string
  args?: Record<string, unknown>
}) {
  // 流式进度文本（仅 isProcessing 时有意义，done 后使用 agentText）
  const streamingText = useAgentStreamingText(isProcessing ? toolCallId : undefined)

  // 缓存 chart 解析结果
  const displayText = isProcessing ? streamingText : agentText
  const segments = useMemo(() => (displayText ? parseChartBlocks(displayText) : []), [displayText])

  return (
    <div className="pl-11 pt-1.5 pb-2">
      {/* 错误信息 */}
      {agentError && (
        <div className="mb-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-800/30 text-xs text-red-600 dark:text-red-400">
          {agentError}
        </div>
      )}

      {/* 思考过程 */}
      {agentReasoning && <ReasoningBlock reasoning={agentReasoning} />}

      {/* 正文 + 图表 */}
      {segments.map((seg, j) =>
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
      )}

      {!isProcessing && !agentText && !agentError && (
        <span className="text-xs text-muted-foreground italic">（无回复内容）</span>
      )}

      {/* 流式输出：处理中且有流式文本时显示 */}
      {isProcessing && streamingText && segments.length === 0 && (
        <div className="text-sm text-foreground/90 leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
          <Streamdown plugins={streamdownPlugins}>{streamingText}</Streamdown>
        </div>
      )}

      {isProcessing && !streamingText && (
        <span className="text-xs text-muted-foreground/50 italic">等待结果…</span>
      )}

      {/* 数据源结果 */}
      {subToolResults && subToolResults.length > 0 && (
        <div className="mt-2.5 space-y-2">
          {subToolResults.map((tr, idx) => (
            <CollapsibleToolResult key={idx} toolResult={tr} />
          ))}
        </div>
      )}
    </div>
  )
})

/* ─── 扁平化子 Agent 区块（始终可展开） ─── */
const DelegateAgentMessage = memo(function DelegateAgentMessage({
  toolName,
  state,
  args,
  result,
  toolCallId,
  className,
}: Omit<AgentMessageProps, "showMeetingHeader">) {
  const agentInfo = AGENT_MAP[toolName] ?? DEFAULT_AGENT
  const isDone = state === "result"
  const isProcessing = !isDone

  // 始终计算数据，保持在 JS 变量中随时可用
  const agentText = useMemo(
    () => (isDone ? extractAgentResultText(result) : null),
    [isDone, result],
  )
  const agentReasoning = useMemo(
    () => (isDone ? extractAgentReasoning(result) : null),
    [isDone, result],
  )
  const agentError = useMemo(() => (isDone ? extractAgentError(result) : null), [isDone, result])
  const subToolResults = useMemo(
    () => (isDone ? extractSubAgentToolResults(result) : null),
    [isDone, result],
  )

  const agentStatus: "done" | "error" | null = isDone ? (agentError ? "error" : "done") : null

  // 子 Agent 默认折叠
  const [open, setOpen] = useState(false)
  // 记录是否曾经展开过，保留已渲染内容避免闪烁
  const [hasOpened, setHasOpened] = useState(false)
  const toggleOpen = useCallback(() => {
    setOpen((prev) => {
      if (!prev) setHasOpened(true)
      return !prev
    })
  }, [])

  // 决定是否挂载重内容：当前展开 或 曾经展开过且已完成
  const shouldMount = open || (hasOpened && isDone)

  return (
    <div className={cn("py-1 animate-in fade-in slide-in-from-bottom-2 duration-400", className)}>
      {/* 触发行：[带 title 的头像] [状态图标（仅 done/error）] [折叠箭头] */}
      <div
        role="button"
        tabIndex={0}
        onClick={toggleOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            toggleOpen()
          }
        }}
        className="flex items-center gap-2 w-full py-1 text-left hover:bg-muted/30 rounded-lg px-1.5 -mx-1.5 transition-colors group cursor-pointer"
      >
        <AgentAvatar
          avatar={agentInfo.avatar}
          avatarBg={agentInfo.avatarBg}
          color={agentInfo.color}
          isProcessing={isProcessing}
        />
        <div className="flex flex-col min-w-0">
          <span className={cn("text-sm font-medium leading-tight", agentInfo.color)}>
            {agentInfo.name}
          </span>
          <span className="text-[11px] text-muted-foreground/70 leading-tight truncate">
            {agentInfo.role}
          </span>
        </div>
        {agentStatus && <AgentStatusIcon status={agentStatus} />}
        <ChevronDown
          className={cn(
            "size-3.5 ml-auto text-muted-foreground/40 transition-transform duration-200 group-hover:text-muted-foreground",
            open ? "rotate-0" : "-rotate-90",
          )}
        />
      </div>

      {/* 折叠内容：仅当 shouldMount 时才挂载重组件 */}
      {shouldMount && (
        <div
          className={cn(
            "grid transition-all duration-300 ease-in-out",
            open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
          )}
        >
          <div className="overflow-hidden">
            <DelegateContent
              agentText={agentText}
              agentReasoning={agentReasoning}
              agentError={agentError}
              subToolResults={subToolResults}
              isProcessing={isProcessing}
              toolCallId={toolCallId}
              args={args}
            />
          </div>
        </div>
      )}
    </div>
  )
})

/* ─── 直接工具调用（非 Agent 委派） ─── */
function DirectToolMessage({
  toolName,
  state,
  args,
  result,
  toolCallId,
  className,
  submitToolOutputs,
}: AgentMessageProps) {
  const toolInfo = TOOL_AGENT_MAP[toolName]
  const toolState = mapToolState(state)
  const summary = state === "result" ? getDataSummary(result) : null

  // 二次确认拦截状态判断
  const isConfRequired =
    state === "result" &&
    result &&
    typeof result === "object" &&
    ((result as any).error === "CONFIRMATION_REQUIRED" ||
      (result as any).metadata?.confirmationRequired === true)

  const metadata = isConfRequired ? (result as any).metadata : null

  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")

  const handleConfirm = async () => {
    if (!metadata || !submitToolOutputs || !toolCallId) return
    setLoading(true)
    setErrorMsg("")
    try {
      const res = await fetch("/api/datasources/execute-write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datasourceId: metadata.datasourceId,
          endpointId: metadata.endpointId,
          params: metadata.params,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "执行写操作失败")
      }

      await submitToolOutputs([{ toolCallId, output: data }])
    } catch (e: any) {
      console.error("确认执行失败:", e)
      setErrorMsg(e.message || "执行发生错误，请重试")
    } finally {
      setLoading(false)
    }
  }

  const handleReject = async () => {
    if (!submitToolOutputs || !toolCallId) return
    setLoading(true)
    setErrorMsg("")
    try {
      await submitToolOutputs([
        {
          toolCallId,
          output: { success: false, error: "用户拒绝执行该操作" },
        },
      ])
    } catch (e: any) {
      console.error("拒绝执行失败:", e)
      setErrorMsg(e.message || "拒绝失败，请重试")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={cn("chat-message", className)}>
      <Tool>
        <ToolHeader
          title={toolInfo?.toolLabel ?? formatToolName(toolName)}
          state={isConfRequired ? "error" : toolState}
          toolName={toolName}
        />
        <ToolContent>
          {args && Object.keys(args).length > 0 && <ToolInput input={args} />}
          {isConfRequired ? (
            <div className="mt-3 p-4 rounded-xl border border-amber-500/25 bg-amber-500/5 dark:bg-amber-950/10 space-y-3 animate-in fade-in duration-300">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg animate-pulse">
                  <AlertCircle className="size-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                    需要操作二次确认
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    AI 触发了敏感的工业写操作（{metadata.method}{" "}
                    {metadata.endpointName || metadata.endpointId}）。
                    执行该操作可能影响真实的底层工业系统，请仔细核对以下参数后选择是否允许执行：
                  </p>
                </div>
              </div>

              {metadata.params && Object.keys(metadata.params).length > 0 && (
                <div className="text-xs bg-background/50 dark:bg-background/20 border rounded-lg p-2.5 font-mono overflow-auto max-h-40 max-w-full space-y-1">
                  {Object.entries(metadata.params).map(([key, val]) => (
                    <div key={key} className="flex gap-2">
                      <span className="text-muted-foreground">{key}:</span>
                      <span className="text-foreground font-medium">{String(val)}</span>
                    </div>
                  ))}
                </div>
              )}

              {errorMsg && <p className="text-xs text-destructive font-medium">{errorMsg}</p>}

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={loading || !submitToolOutputs}
                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {loading && (
                    <div className="size-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  确认允许
                </button>
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={loading || !submitToolOutputs}
                  className="px-3.5 py-1.5 bg-secondary hover:bg-secondary/80 disabled:opacity-50 text-secondary-foreground rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  拒绝操作
                </button>
              </div>
            </div>
          ) : (
            state === "result" && (
              <>
                {summary && (
                  <span className="text-xs text-muted-foreground mt-2 mb-2 inline-block">
                    📊 摘要: {summary}
                  </span>
                )}
                <ToolOutput output={result} />
              </>
            )
          )}
        </ToolContent>
      </Tool>
    </div>
  )
}
