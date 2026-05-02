"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

interface Model {
  id: string
  name: string
  status: "available" | "offline"
  enabled: boolean
}

interface ModelsPanelProps {
  providerId: string
  models: Model[]
  onSync: () => void
}

export function ModelsPanel({ providerId, models, onSync }: ModelsPanelProps) {
  const [expanded, setExpanded] = useState(false)
  const [localModels, setLocalModels] = useState(models)

  async function toggleModel(modelId: string, enabled: boolean) {
    try {
      await fetch(`/api/admin/providers/${providerId}/models`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId, enabled }),
      })
      setLocalModels((ms) => ms.map((m) => (m.id === modelId ? { ...m, enabled } : m)))
    } catch {
      alert("操作失败")
    }
  }

  if (!expanded) {
    return (
      <button onClick={() => setExpanded(true)} className="text-sm text-blue-600 hover:underline">
        展开模型列表 ({models.length})
      </button>
    )
  }

  return (
    <div className="mt-2 border rounded p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">模型列表</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onSync}>同步模型</Button>
          <button onClick={() => setExpanded(false)} className="text-xs text-gray-500">收起</button>
        </div>
      </div>
      {localModels.length === 0 ? (
        <p className="text-sm text-gray-500">暂无模型，请同步</p>
      ) : (
        <ul className="space-y-1">
          {localModels.map((m) => (
            <li key={m.id} className="flex items-center justify-between text-sm py-1 px-2 rounded hover:bg-gray-50">
              <div className="flex items-center gap-2">
                <span>{m.name}</span>
                <span className={`inline-block px-1.5 py-0.5 text-xs rounded ${m.status === "available" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {m.status === "available" ? "在线" : "离线"}
                </span>
              </div>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={m.enabled}
                  onChange={(e) => toggleModel(m.id, e.target.checked)}
                  className="rounded"
                />
                <span className="text-xs">启用</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
