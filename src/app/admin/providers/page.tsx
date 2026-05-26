"use client"

import { useEffect, useState, useCallback } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ProviderDialog } from "./components/provider-dialog"
import { ModelsPanel } from "./components/models-panel"

interface Model {
  id: string
  name: string
  status: "available" | "offline"
  enabled: boolean
}

interface Provider {
  id: string
  name: string
  type: "cloud" | "local"
  apiFormat: string
  baseUrl: string
  apiKey?: string
  apiKeyRequired?: boolean
  enabled: boolean
  models: Model[]
}

function maskKey(key?: string) {
  if (!key) return "—"
  if (key.length <= 8) return "****"
  return key.slice(0, 4) + "****" + key.slice(-4)
}

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editProvider, setEditProvider] = useState<Provider | null>(null)

  const fetchProviders = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/providers")
      const data = await res.json()
      setProviders(Array.isArray(data) ? data : (data.providers ?? []))
    } catch {
      toast.error("加载提供商列表失败")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchProviders()
  }, [fetchProviders])

  function openAdd() {
    setEditProvider(null)
    setDialogOpen(true)
  }

  function openEdit(p: Provider) {
    setEditProvider(p)
    setDialogOpen(true)
  }

  async function testConnection(id: string) {
    try {
      const res = await fetch(`/api/admin/providers/${id}/test`, { method: "POST" })
      const data = await res.json()
      toast[data.success ? "success" : "error"](
        data.success ? "连接成功" : `连接失败: ${data.error || "未知错误"}`,
      )
    } catch {
      toast.error("测试请求失败")
    }
  }

  async function syncModels(id: string) {
    try {
      const res = await fetch(`/api/admin/providers/${id}/sync`, { method: "POST" })
      if (res.ok) {
        toast.success("同步完成")
        fetchProviders()
      } else {
        toast.error("同步失败")
      }
    } catch {
      toast.error("同步请求失败")
    }
  }

  async function toggleEnabled(id: string, enabled: boolean) {
    try {
      await fetch(`/api/admin/providers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      })
      setProviders((ps) => ps.map((p) => (p.id === id ? { ...p, enabled } : p)))
    } catch {
      toast.error("操作失败")
    }
  }

  async function deleteProvider(id: string, name: string) {
    if (!confirm(`确定删除提供商「${name}」？`)) return
    try {
      await fetch(`/api/admin/providers/${id}`, { method: "DELETE" })
      fetchProviders()
    } catch {
      toast.error("删除失败")
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">提供商管理</h1>
        <Button onClick={openAdd}>+ 添加提供商</Button>
      </div>

      {loading ? (
        <p className="text-gray-500">加载中...</p>
      ) : providers.length === 0 ? (
        <p className="text-gray-500">暂无提供商，点击上方按钮添加</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {providers.map((p) => (
            <Card key={p.id} className={!p.enabled ? "opacity-60" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{p.name}</CardTitle>
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${p.type === "cloud" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"}`}
                  >
                    {p.type === "cloud" ? "云端" : "本地"}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-sm text-gray-600 space-y-1">
                  <p>
                    Base URL:{" "}
                    <code className="text-xs bg-gray-100 px-1 rounded">{p.baseUrl || "—"}</code>
                  </p>
                  <p>
                    API Key:{" "}
                    <code className="text-xs bg-gray-100 px-1 rounded">{maskKey(p.apiKey)}</code>
                  </p>
                  <p>模型数: {p.models?.length ?? 0}</p>
                </div>

                <div className="flex items-center gap-2 pt-2 flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => testConnection(p.id)}>
                    测试连接
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => syncModels(p.id)}>
                    同步模型
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
                    编辑
                  </Button>
                  <label className="flex items-center gap-1 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={p.enabled}
                      onChange={(e) => toggleEnabled(p.id, e.target.checked)}
                    />
                    启用
                  </label>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => deleteProvider(p.id, p.name)}
                  >
                    删除
                  </Button>
                </div>

                {p.models && (
                  <ModelsPanel
                    providerId={p.id}
                    models={p.models}
                    onSync={() => syncModels(p.id)}
                  />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ProviderDialog
        key={editProvider?.id ?? "new"}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        provider={editProvider}
        onSaved={fetchProviders}
      />
    </div>
  )
}
