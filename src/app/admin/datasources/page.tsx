"use client"

import { useState } from "react"
import Link from "next/link"
import { Plus, Zap, Pencil, Trash2, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useDatasources } from "@/hooks/use-datasources"

const typeBadge: Record<string, { label: string; color: string }> = {
  rest: {
    label: "REST API",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  },
  graphql: {
    label: "GraphQL",
    color: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  },
  grpc: {
    label: "gRPC",
    color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  },
  opcua: {
    label: "OPC UA",
    color: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  },
  mqtt: { label: "MQTT", color: "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300" },
}

export default function DatasourcesPage() {
  const { datasources, loading, error, refresh, remove, testConnection } = useDatasources()
  const [testStatus, setTestStatus] = useState<Record<string, "testing" | "ok" | "failed">>({})

  const handleTest = async (id: string) => {
    setTestStatus((s) => ({ ...s, [id]: "testing" }))
    try {
      const result = await testConnection(id)
      setTestStatus((s) => ({ ...s, [id]: result.ok ? "ok" : "failed" }))
      if (result.ok) {
        toast.success("连接测试成功")
      } else {
        toast.error("连接测试失败")
      }
    } catch {
      setTestStatus((s) => ({ ...s, [id]: "failed" }))
      toast.error("连接测试失败")
    }
  }

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    if (deleteConfirm !== id) {
      setDeleteConfirm(id)
      toast("再次点击确认删除", { duration: 3000 })
      setTimeout(() => setDeleteConfirm(null), 3000)
      return
    }
    setDeleteConfirm(null)
    try {
      await remove(id)
      toast.success("数据源已删除")
    } catch {
      toast.error("删除失败，请重试")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-sm text-red-500 mb-4">{error}</p>
        <button
          onClick={refresh}
          className="px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors text-sm"
        >
          重试
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">数据源列表</h2>
        <Link
          href="/admin/datasources/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm transition-colors hover:bg-primary/90"
        >
          <Plus className="size-4" />
          新建数据源
        </Link>
      </div>

      {datasources.length === 0 ? (
        <div className="text-center py-20 text-sm text-muted-foreground">
          暂无数据源，点击上方按钮创建
        </div>
      ) : (
        <div className="border border-border rounded-lg divide-y divide-border">
          {datasources.map((ds) => {
            const badge = typeBadge[ds.type] ?? {
              label: ds.type,
              color: "bg-muted text-muted-foreground",
            }
            const status = testStatus[ds.id]
            return (
              <div key={ds.id} className="flex items-center justify-between px-4 py-3 gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm truncate">{ds.name}</span>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${badge.color}`}>
                      {badge.label}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-xs rounded-full ${ds.enabled ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" : "bg-muted text-muted-foreground"}`}
                    >
                      {ds.enabled ? "启用" : "禁用"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {ds.description || ds.id}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {status && (
                    <span
                      className={`text-xs mr-2 ${status === "testing" ? "text-muted-foreground" : status === "ok" ? "text-green-600" : "text-red-500"}`}
                    >
                      {status === "testing"
                        ? "测试中..."
                        : status === "ok"
                          ? "连接成功"
                          : "连接失败"}
                    </span>
                  )}
                  <button
                    onClick={() => handleTest(ds.id)}
                    title="测试连接"
                    className="p-2 rounded-lg hover:bg-muted transition-colors"
                  >
                    <Zap className="size-4" />
                  </button>
                  <Link
                    href={`/admin/datasources/${ds.id}/edit`}
                    className="p-2 rounded-lg hover:bg-muted transition-colors"
                  >
                    <Pencil className="size-4" />
                  </Link>
                  <button
                    onClick={() => handleDelete(ds.id)}
                    title="删除"
                    className="p-2 rounded-lg hover:bg-muted text-red-500 transition-colors"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
