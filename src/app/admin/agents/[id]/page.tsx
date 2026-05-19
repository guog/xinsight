"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Loader2, Pencil } from "lucide-react"
import type { AdminAgent } from "@/hooks/use-admin-agents"

export default function AgentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [agent, setAgent] = useState<AdminAgent | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    async function fetchAgent() {
      try {
        const res = await fetch(`/api/admin/agents/${id}`)
        if (res.status === 404) {
          setError("Agent 不存在")
          return
        }
        if (!res.ok) {
          setError("加载失败")
          return
        }
        const data = await res.json()
        setAgent(data.agent ?? data)
      } catch {
        setError("网络错误")
      } finally {
        setLoading(false)
      }
    }
    fetchAgent()
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !agent) {
    return (
      <div className="max-w-2xl mx-auto py-10 px-4">
        <Link
          href="/admin/agents"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          返回列表
        </Link>
        <p className="text-destructive">{error || "Agent 不存在"}</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/admin/agents"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          返回列表
        </Link>
        {!agent.isBuiltin && (
          <Link
            href={`/admin/agents/${agent.id}/edit`}
            className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Pencil className="h-3.5 w-3.5" />
            编辑
          </Link>
        )}
      </div>

      <div className="space-y-6">
        {/* 头部 */}
        <div className="flex items-center gap-3">
          <span className="text-3xl">{agent.icon || "🤖"}</span>
          <div>
            <h1 className="text-2xl font-bold">{agent.name}</h1>
            <p className="text-sm text-muted-foreground font-mono">{agent.id}</p>
          </div>
        </div>

        {/* 状态标签 */}
        <div className="flex items-center gap-2">
          {agent.isBuiltin && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              内置
            </span>
          )}
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              agent.enabled
                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
            }`}
          >
            {agent.enabled ? "已启用" : "已禁用"}
          </span>
        </div>

        {/* 描述 */}
        {agent.description && (
          <div>
            <h2 className="text-sm font-medium text-muted-foreground mb-1">描述</h2>
            <p className="text-sm">{agent.description}</p>
          </div>
        )}

        {/* 模型 */}
        {agent.modelId && (
          <div>
            <h2 className="text-sm font-medium text-muted-foreground mb-1">模型</h2>
            <p className="text-sm font-mono">{agent.modelId}</p>
          </div>
        )}

        {/* 系统提示词 */}
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-1">系统提示词</h2>
          <pre className="text-sm bg-muted rounded-md p-4 max-h-80 overflow-auto whitespace-pre-wrap break-words">
            <code>{agent.systemPrompt}</code>
          </pre>
        </div>

        {/* 时间 */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">创建时间</span>
            <p>{new Date(agent.createdAt).toLocaleString("zh-CN")}</p>
          </div>
          <div>
            <span className="text-muted-foreground">更新时间</span>
            <p>{new Date(agent.updatedAt).toLocaleString("zh-CN")}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
