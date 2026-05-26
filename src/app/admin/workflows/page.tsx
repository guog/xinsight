"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  Play,
  Plus,
  Trash2,
  Edit,
  History,
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
} from "lucide-react"
import { toast } from "sonner"

interface Workflow {
  id: string
  name: string
  description: string | null
  definition: string
  status: "draft" | "published"
  version: number
  createdAt: string
  updatedAt: string
}

interface Execution {
  id: string
  workflowId: string
  workflowName: string | null
  status: "running" | "completed" | "failed"
  startedAt: string
  completedAt: string | null
}

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [executions, setExecutions] = useState<Execution[]>([])
  const [activeTab, setActiveTab] = useState<"workflows" | "executions">("workflows")
  const [loading, setLoading] = useState(true)
  const [executingId, setExecutingId] = useState<string | null>(null)

  // 获取数据
  const fetchData = async (showLoading = false) => {
    if (showLoading) {
      setLoading(true)
    }
    try {
      const [wfRes, execRes] = await Promise.all([
        fetch("/api/admin/workflows"),
        fetch("/api/admin/workflows/executions"),
      ])

      if (wfRes.ok) {
        const data = await wfRes.json()
        setWorkflows(data.workflows || [])
      }
      if (execRes.ok) {
        const data = await execRes.json()
        setExecutions(data.executions || [])
      }
    } catch (error) {
      console.error("加载工作流数据失败:", error)
      toast.error("加载工作流数据失败")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData()
  }, [])

  // 触发工作流执行
  const handleTrigger = async (id: string) => {
    setExecutingId(id)
    const promptInput = window.prompt(
      '请输入工作流初始输入参数 (JSON格式，例如: {"content": "测试"})',
    )
    if (promptInput === null) {
      setExecutingId(null)
      return
    }

    let inputObj = {}
    if (promptInput.trim()) {
      try {
        inputObj = JSON.parse(promptInput)
      } catch {
        toast.error("请输入合法的 JSON 字符串")
        setExecutingId(null)
        return
      }
    }

    try {
      const res = await fetch(`/api/admin/workflows/${id}/trigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: inputObj }),
      })

      if (res.ok) {
        const data = await res.json()
        toast.success("工作流执行完成！")
        console.log("执行结果:", data.result)
        fetchData()
      } else {
        const data = await res.json()
        toast.error(`执行失败: ${data.error || "未知错误"}`)
      }
    } catch (error) {
      console.error("触发工作流异常:", error)
      toast.error("触发工作流异常")
    } finally {
      setExecutingId(null)
    }
  }

  // 删除工作流
  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除该工作流吗？此操作无法撤销。")) return

    try {
      const res = await fetch(`/api/admin/workflows/${id}`, {
        method: "DELETE",
      })

      if (res.ok) {
        toast.success("工作流删除成功")
        fetchData()
      } else {
        const data = await res.json()
        toast.error(`删除失败: ${data.error || "未知错误"}`)
      }
    } catch (error) {
      console.error("删除工作流异常:", error)
      toast.error("删除工作流异常")
    }
  }

  return (
    <div className="space-y-6">
      {/* 头部控制栏 */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight bg-gradient-to-r from-primary to-violet-600 bg-clip-text text-transparent">
            工作流编排
          </h2>
          <p className="text-sm text-muted-foreground">
            可视化设计多步骤 Agent 与外部数据源端点的协同执行工作流。
          </p>
        </div>
        <Link
          href="/admin/workflows/new"
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 active:scale-95 transition-all rounded-xl shadow-lg shadow-primary/20"
        >
          <Plus className="size-4" />
          新建工作流
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab("workflows")}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === "workflows"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileText className="size-4" />
          工作流定义 ({workflows.length})
        </button>
        <button
          onClick={() => setActiveTab("executions")}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === "executions"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <History className="size-4" />
          运行历史 ({executions.length})
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
          加载中...
        </div>
      ) : activeTab === "workflows" ? (
        workflows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 border border-dashed border-border rounded-2xl bg-muted/30">
            <p className="text-muted-foreground text-sm mb-4">暂无已配置的工作流</p>
            <Link
              href="/admin/workflows/new"
              className="text-xs text-primary hover:underline font-semibold"
            >
              立即去创建第一个工作流 -&gt;
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {workflows.map((wf) => {
              let nodeCount = 0
              try {
                const def = JSON.parse(wf.definition)
                nodeCount = def?.nodes?.length || 0
              } catch {}

              return (
                <div
                  key={wf.id}
                  className="flex flex-col justify-between p-5 rounded-2xl border border-border bg-card/60 backdrop-blur hover:shadow-md hover:border-primary/30 transition-all group"
                >
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-base group-hover:text-primary transition-colors">
                          {wf.name}
                        </h3>
                        <span className="text-xs font-mono text-muted-foreground select-all">
                          ID: {wf.id}
                        </span>
                      </div>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                          wf.status === "published"
                            ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                            : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                        }`}
                      >
                        {wf.status === "published" ? "已发布" : "草稿"}
                      </span>
                    </div>

                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {wf.description || "无描述"}
                    </p>

                    <div className="flex gap-4 text-xs text-muted-foreground pt-2">
                      <div>
                        步骤节点: <span className="font-medium text-foreground">{nodeCount}</span>
                      </div>
                      <div>
                        版本: <span className="font-medium text-foreground">v{wf.version}</span>
                      </div>
                      <div>
                        更新于:{" "}
                        <span className="font-medium text-foreground">
                          {new Date(wf.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 mt-5 pt-3 border-t border-border">
                    <button
                      onClick={() => handleTrigger(wf.id)}
                      disabled={executingId === wf.id}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-500/10 rounded-lg transition-colors disabled:opacity-50"
                      title="运行工作流"
                    >
                      <Play className="size-3.5 fill-emerald-600/20" />
                      {executingId === wf.id ? "运行中" : "运行"}
                    </button>
                    <Link
                      href={`/admin/workflows/${wf.id}/edit`}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      title="编辑定义"
                    >
                      <Edit className="size-3.5" />
                      编辑
                    </Link>
                    <button
                      onClick={() => handleDelete(wf.id)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                      title="删除工作流"
                    >
                      <Trash2 className="size-3.5" />
                      删除
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )
      ) : executions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border border-dashed border-border rounded-2xl bg-muted/30">
          <p className="text-muted-foreground text-sm">暂无执行历史</p>
        </div>
      ) : (
        <div className="border border-border rounded-2xl overflow-hidden bg-card/60 backdrop-blur">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th className="p-3 font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                  工作流
                </th>
                <th className="p-3 font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                  执行实例 ID
                </th>
                <th className="p-3 font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                  状态
                </th>
                <th className="p-3 font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                  启动时间
                </th>
                <th className="p-3 font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                  完成时间
                </th>
                <th className="p-3 font-semibold text-xs text-muted-foreground uppercase tracking-wider text-right">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {executions.map((exec) => (
                <tr key={exec.id} className="hover:bg-muted/30 transition-colors">
                  <td className="p-3 font-medium text-foreground">
                    {exec.workflowName || exec.workflowId}
                  </td>
                  <td className="p-3 font-mono text-xs text-muted-foreground select-all">
                    {exec.id}
                  </td>
                  <td className="p-3">
                    <span className="flex items-center gap-1.5">
                      {exec.status === "completed" && (
                        <>
                          <CheckCircle2 className="size-4 text-emerald-500" />
                          <span className="text-xs text-emerald-600 font-medium">成功</span>
                        </>
                      )}
                      {exec.status === "failed" && (
                        <>
                          <XCircle className="size-4 text-destructive" />
                          <span className="text-xs text-destructive font-medium">失败</span>
                        </>
                      )}
                      {exec.status === "running" && (
                        <>
                          <Clock className="size-4 text-primary animate-pulse" />
                          <span className="text-xs text-primary font-medium animate-pulse">
                            进行中
                          </span>
                        </>
                      )}
                    </span>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {new Date(exec.startedAt).toLocaleString()}
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {exec.completedAt ? new Date(exec.completedAt).toLocaleString() : "-"}
                  </td>
                  <td className="p-3 text-right">
                    <Link
                      href={`/admin/workflows/executions/${exec.id}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold border border-border hover:border-primary/30 hover:text-primary rounded-lg transition-all"
                    >
                      <AlertCircle className="size-3" />
                      运行 Trace
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
