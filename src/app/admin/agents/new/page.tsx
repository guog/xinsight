"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import { AgentForm } from "@/components/agent-form"
import { toast } from "sonner"

export default function NewAgentPage() {
  const router = useRouter()

  const handleSubmit = async (data: Record<string, unknown>) => {
    const res = await fetch("/api/admin/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "创建失败" }))
      toast.error(err.error || "创建失败")
      throw new Error(err.error || "创建失败")
    }
    router.push("/admin/agents")
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <Link
        href="/admin/agents"
        className="text-muted-foreground hover:text-foreground mb-4 inline-block text-sm"
      >
        ← 返回 Agent 列表
      </Link>
      <h1 className="mb-6 text-2xl font-bold">创建 Agent</h1>
      <AgentForm onSubmit={handleSubmit} />
    </div>
  )
}
