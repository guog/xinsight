"use client"

import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { useEffect, useState } from "react"
import { AgentForm, type DatasourceBinding } from "@/components/agent-form"
import { toast } from "sonner"
import type { AdminAgent } from "@/hooks/use-admin-agents"

export default function EditAgentPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [agent, setAgent] = useState<AdminAgent | null>(null)
  const [initialBindings, setInitialBindings] = useState<DatasourceBinding[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    Promise.all([
      fetch(`/api/admin/agents/${id}`).then(async (res) => {
        if (!res.ok) throw new Error("加载失败")
        return res.json()
      }),
      fetch(`/api/admin/agents/${id}/datasources`).then(async (res) => {
        if (!res.ok) return { bindings: [] }
        return res.json()
      }),
    ])
      .then(([agentData, dsData]) => {
        setAgent(agentData.agent)
        setInitialBindings(dsData.bindings ?? [])
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  const handleSubmit = async (data: Record<string, unknown>) => {
    const { bindings, ...agentData } = data as Record<string, unknown> & {
      bindings?: DatasourceBinding[]
    }

    const res = await fetch(`/api/admin/agents/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(agentData),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "保存失败" }))
      toast.error(err.error || "保存失败")
      throw new Error(err.error || "保存失败")
    }

    const bindRes = await fetch(`/api/admin/agents/${id}/datasources`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bindings: bindings ?? [] }),
    })
    if (!bindRes.ok) {
      toast.error("数据源绑定保存失败")
    }

    router.push("/admin/agents")
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    )
  }

  if (error || !agent) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <p className="text-destructive">{error || "Agent 不存在"}</p>
        <Link
          href="/admin/agents"
          className="text-muted-foreground hover:text-foreground mt-4 inline-block text-sm"
        >
          ← 返回 Agent 列表
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <Link
        href="/admin/agents"
        className="text-muted-foreground hover:text-foreground mb-4 inline-block text-sm"
      >
        ← 返回 Agent 列表
      </Link>
      <h1 className="mb-6 text-2xl font-bold">编辑 Agent</h1>
      <AgentForm
        initialData={agent}
        initialBindings={initialBindings}
        onSubmit={handleSubmit}
        isEdit
      />
    </div>
  )
}
