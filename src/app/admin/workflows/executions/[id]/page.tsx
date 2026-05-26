"use client"

import React, { useEffect, useState, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Cpu,
  Database,
  Eye,
} from "lucide-react"
import { toast } from "sonner"

interface Node {
  id: string
  type: "agent" | "tool"
  x: number
  y: number
  config: any
}

interface Edge {
  source: string
  target: string
}

interface TraceLog {
  nodeId: string
  type: "agent" | "tool"
  status: "success" | "failed"
  input: any
  output: any
  error?: string
  startedAt: string
  endedAt: string
  duration: number
}

interface ExecutionDetails {
  id: string
  workflowId: string
  workflowName: string | null
  status: "running" | "completed" | "failed"
  input: any
  output: any
  logs: TraceLog[]
  startedAt: string
  completedAt: string | null
}

export default function ExecutionTracePage() {
  const params = useParams()
  const router = useRouter()
  const execId = params.id as string

  const [execution, setExecution] = useState<ExecutionDetails | null>(null)
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchTraceDetails = async () => {
      try {
        // 1. 获取运行记录详情
        const execRes = await fetch(`/api/admin/workflows/executions/${execId}`)
        if (!execRes.ok) {
          toast.error("加载执行记录失败")
          setLoading(false)
          return
        }
        const execData = await execRes.json()
        const execObj = execData.execution as ExecutionDetails
        setExecution(execObj)

        // 2. 根据 workflowId 获取原始拓扑节点定义以供画图
        const wfRes = await fetch(`/api/admin/workflows/${execObj.workflowId}`)
        if (wfRes.ok) {
          const wfData = await wfRes.json()
          const definition = JSON.parse(wfData.workflow.definition)
          setNodes(definition.nodes || [])
          setEdges(definition.edges || [])
        }
      } catch (error) {
        console.error("加载执行 Trace 异常:", error)
        toast.error("加载执行 Trace 异常")
      } finally {
        setLoading(false)
      }
    }

    if (execId) {
      fetchTraceDetails()
    }
  }, [execId])

  // 计算贝塞尔曲线
  const getBezierPath = (x1: number, y1: number, x2: number, y2: number) => {
    const cp1x = x1 + Math.abs(x2 - x1) * 0.4
    const cp2x = x2 - Math.abs(x2 - x1) * 0.4
    return `M ${x1} ${y1} C ${cp1x} ${y1}, ${cp2x} ${y2}, ${x2} ${y2}`
  }

  if (loading) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        加载 Trace 运行日志中...
      </div>
    )
  }

  if (!execution) {
    return (
      <div className="text-center py-12 text-destructive text-sm">运行实例未找到或无权查看。</div>
    )
  }

  // 节点对应的日志条目
  const getLogForNode = (nodeId: string) => {
    return execution.logs?.find((l) => l.nodeId === nodeId)
  }

  // 获取节点执行染色样式
  const getNodeStatusStyle = (nodeId: string) => {
    const log = getLogForNode(nodeId)
    if (!log) {
      if (execution.status === "running") {
        return "border-muted text-muted-foreground bg-muted/40"
      }
      return "border-slate-200 text-slate-400 bg-slate-100/50 dark:border-zinc-800 dark:bg-zinc-900/50"
    }

    if (log.status === "success") {
      return "border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 shadow-sm shadow-emerald-500/10"
    }

    return "border-destructive bg-destructive/10 text-destructive shadow-sm shadow-destructive/10 animate-shake"
  }

  const selectedNode = nodes.find((n) => n.id === selectedNodeId)
  const selectedNodeLog = selectedNodeId ? getLogForNode(selectedNodeId) : null

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] border border-border rounded-2xl overflow-hidden bg-background">
      {/* 头部状态条 */}
      <header className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-border bg-card/60 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/admin/workflows")}
            className="p-2 border border-border hover:bg-muted active:scale-95 transition-all rounded-lg"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base">
                运行 Trace: {execution.workflowName || execution.workflowId}
              </h3>
              <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded-md">
                实例: {execution.id.slice(0, 8)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              启动时间: {new Date(execution.startedAt).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* 状态徽章 */}
          <div className="flex items-center gap-1.5">
            {execution.status === "completed" && (
              <>
                <CheckCircle2 className="size-4 text-emerald-500" />
                <span className="text-xs text-emerald-600 font-semibold">成功完成</span>
              </>
            )}
            {execution.status === "failed" && (
              <>
                <XCircle className="size-4 text-destructive" />
                <span className="text-xs text-destructive font-semibold">运行失败</span>
              </>
            )}
            {execution.status === "running" && (
              <>
                <Clock className="size-4 text-primary animate-pulse" />
                <span className="text-xs text-primary font-semibold animate-pulse">执行中</span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 画布与日志面板 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 画布 */}
        <div
          ref={canvasRef}
          className="flex-1 relative overflow-auto bg-slate-50 dark:bg-zinc-950/40 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] select-none"
        >
          {/* SVG 连线图层 */}
          <svg className="absolute top-0 left-0 w-[2000px] h-[2000px] pointer-events-none z-0">
            {edges.map((edge, idx) => {
              const fromNode = nodes.find((n) => n.id === edge.source)
              const toNode = nodes.find((n) => n.id === edge.target)
              if (!fromNode || !toNode) return null

              const x1 = fromNode.x + 180
              const y1 = fromNode.y + 40
              const x2 = toNode.x
              const y2 = toNode.y + 40

              // 检查此连线的状态：如果源节点执行成功，连线呈绿色；执行失败则为灰色或红色。
              const sourceLog = getLogForNode(edge.source)
              const strokeColor =
                sourceLog?.status === "success"
                  ? "stroke-emerald-500/80"
                  : sourceLog?.status === "failed"
                    ? "stroke-destructive/80"
                    : "stroke-muted-foreground/30"

              return (
                <path
                  key={idx}
                  d={getBezierPath(x1, y1, x2, y2)}
                  fill="none"
                  className={`${strokeColor} transition-all`}
                  strokeWidth="2.5"
                />
              )
            })}
          </svg>

          {/* 节点层 */}
          <div className="absolute top-0 left-0 w-[2000px] h-[2000px] pointer-events-none">
            {nodes.map((node) => {
              const isSelected = node.id === selectedNodeId
              const nodeLog = getLogForNode(node.id)
              const colorClass = getNodeStatusStyle(node.id)

              return (
                <button
                  key={node.id}
                  onClick={() => setSelectedNodeId(node.id)}
                  style={{ left: node.x, top: node.y }}
                  className={`absolute w-[180px] p-3 rounded-xl border text-left shadow-sm select-none pointer-events-auto transition-all cursor-pointer z-10 ${colorClass} ${
                    isSelected ? "ring-2 ring-primary/40 scale-105" : "hover:scale-102"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider opacity-80">
                      {node.type === "agent" ? (
                        <Cpu className="size-3" />
                      ) : (
                        <Database className="size-3" />
                      )}
                      {node.type === "agent" ? "Agent" : "Tool"}
                    </span>
                    {nodeLog && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-background/50 font-mono font-bold">
                        {nodeLog.duration}ms
                      </span>
                    )}
                  </div>

                  <div className="text-xs font-bold truncate">{node.id}</div>

                  <div className="text-[10px] opacity-75 mt-1 truncate">
                    {nodeLog
                      ? nodeLog.status === "success"
                        ? "✓ 执行成功"
                        : "✗ 执行失败"
                      : "未执行 (已跳过)"}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* 右侧 Trace 属性与日志详情 */}
        <aside className="w-96 border-l border-border bg-card/60 backdrop-blur p-5 overflow-y-auto space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <Eye className="size-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">运行日志属性查看</h3>
          </div>

          {selectedNode ? (
            <div className="space-y-4 text-xs">
              <div>
                <span className="text-muted-foreground font-semibold block mb-0.5">节点标识:</span>
                <span className="font-mono text-foreground font-bold">{selectedNode.id}</span>
              </div>

              <div>
                <span className="text-muted-foreground font-semibold block mb-0.5">节点类型:</span>
                <span className="capitalize">
                  {selectedNode.type === "agent" ? "大模型 Agent" : "API 数据源端点"}
                </span>
              </div>

              {selectedNodeLog ? (
                <>
                  <div className="p-3 border border-border rounded-xl bg-muted/20 space-y-2">
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase font-bold">
                        执行状态:
                      </span>
                      <span
                        className={`font-semibold ${
                          selectedNodeLog.status === "success"
                            ? "text-emerald-600"
                            : "text-destructive"
                        }`}
                      >
                        {selectedNodeLog.status === "success" ? "成功" : "失败"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase font-bold">
                        耗时:
                      </span>
                      <span className="font-mono font-medium text-foreground">
                        {selectedNodeLog.duration} ms
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase font-bold">
                        运行时刻:
                      </span>
                      <span className="font-mono text-muted-foreground text-[10px]">
                        {new Date(selectedNodeLog.startedAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="text-muted-foreground font-semibold block mb-1">
                      输入参数 (Payload):
                    </span>
                    <pre className="p-3 rounded-lg border border-border bg-muted/60 font-mono text-[10px] leading-relaxed overflow-x-auto">
                      {JSON.stringify(selectedNodeLog.input || {}, null, 2)}
                    </pre>
                  </div>

                  <div>
                    <span className="text-muted-foreground font-semibold block mb-1">
                      输出结果 (Response):
                    </span>
                    <pre className="p-3 rounded-lg border border-border bg-muted/60 font-mono text-[10px] leading-relaxed overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(selectedNodeLog.output || {}, null, 2)}
                    </pre>
                  </div>

                  {selectedNodeLog.error && (
                    <div className="p-3 rounded-lg border border-destructive/20 bg-destructive/5 text-destructive space-y-1">
                      <span className="font-semibold flex items-center gap-1">
                        <AlertCircle className="size-3.5" />
                        错误堆栈 (Exception):
                      </span>
                      <p className="font-mono text-[10px] break-all leading-normal">
                        {selectedNodeLog.error}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-4 border border-dashed border-border rounded-xl text-center text-muted-foreground text-[11px]">
                  该节点目前未被激活执行。前续步骤失败或由于工作流尚未流转至此。
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-border bg-muted/20 text-xs text-muted-foreground space-y-2">
                <p className="font-semibold text-foreground">全局输入参数 (Global Input):</p>
                <pre className="p-2 border border-border rounded bg-background font-mono text-[10px] overflow-x-auto">
                  {JSON.stringify(execution.input || {}, null, 2)}
                </pre>

                <p className="font-semibold text-foreground mt-3">最终执行输出 (Final Output):</p>
                <pre className="p-2 border border-border rounded bg-background font-mono text-[10px] overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(execution.output || {}, null, 2)}
                </pre>
              </div>

              <div className="text-center py-6 text-muted-foreground text-xs">
                在中央只读拓扑画布上点击各个节点，可溯源其独立的 Payload 运行链路及具体 API I/O
                状态。
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
