"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import DatasourceForm from "@/components/datasource-form"
import type { Datasource } from "@/hooks/use-datasources"

export default function EditDatasourcePage() {
  const params = useParams()
  const id = params?.id as string
  const [data, setData] = useState<(Datasource & { agents?: string[] }) | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    Promise.all([
      fetch(`/api/datasources/${id}`).then((r) => {
        if (!r.ok) throw new Error("获取数据源失败")
        return r.json()
      }),
      fetch(`/api/datasources/${id}/agents`)
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
    ])
      .then(([ds, agents]) => {
        setData({
          ...ds,
          agents:
            agents.map?.((a: { agentId: string } | string) =>
              typeof a === "string" ? a : a.agentId,
            ) ?? agents,
        })
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !data) {
    return <div className="text-center py-20 text-sm text-red-500">{error || "数据源不存在"}</div>
  }

  return (
    <div>
      <h2 className="text-lg font-medium mb-6">编辑数据源: {data.name}</h2>
      <DatasourceForm initialData={data} isEdit />
    </div>
  )
}
