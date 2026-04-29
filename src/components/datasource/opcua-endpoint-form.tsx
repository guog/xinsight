"use client"

import { Trash2, Plus, X } from "lucide-react"
import type { OpcuaEndpoint } from "@/mastra/tools/datasource/types"

const inputClass =
  "w-full px-3 py-2 text-sm rounded-lg border border-border bg-transparent focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
const labelClass = "block text-sm font-medium mb-1"

interface Props {
  endpoint: OpcuaEndpoint
  onChange: (ep: OpcuaEndpoint) => void
  onRemove: () => void
}

const actions = ["read", "write", "browse"] as const

export default function OpcuaEndpointForm({ endpoint, onChange, onRemove }: Props) {
  const update = (partial: Partial<OpcuaEndpoint>) => onChange({ ...endpoint, ...partial } as OpcuaEndpoint)

  const addNodeId = () => update({ nodeIds: [...endpoint.nodeIds, ""] })
  const removeNodeId = (i: number) => update({ nodeIds: endpoint.nodeIds.filter((_, idx) => idx !== i) })
  const updateNodeId = (i: number, val: string) => update({ nodeIds: endpoint.nodeIds.map((n, idx) => (idx === i ? val : n)) })

  return (
    <div className="border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{endpoint.name || "OPC UA 接口"}</span>
        <button type="button" onClick={onRemove} className="p-1 rounded hover:bg-muted text-red-500 transition-colors">
          <Trash2 className="size-4" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className={labelClass}>ID</label>
          <input className={inputClass} value={endpoint.id} onChange={(e) => update({ id: e.target.value })} />
        </div>
        <div>
          <label className={labelClass}>名称</label>
          <input className={inputClass} value={endpoint.name} onChange={(e) => update({ name: e.target.value })} />
        </div>
        <div>
          <label className={labelClass}>Action</label>
          <select className={inputClass} value={endpoint.action} onChange={(e) => update({ action: e.target.value as OpcuaEndpoint["action"] })}>
            {actions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass}>Node IDs</label>
        <div className="space-y-2">
          {endpoint.nodeIds.map((nodeId, i) => (
            <div key={i} className="flex gap-2">
              <input className={inputClass} value={nodeId} onChange={(e) => updateNodeId(i, e.target.value)} placeholder="ns=2;s=Temperature" />
              <button type="button" onClick={() => removeNodeId(i)} className="p-1 text-red-500 hover:bg-muted rounded">
                <X className="size-4" />
              </button>
            </div>
          ))}
          <button type="button" onClick={addNodeId} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <Plus className="size-3" /> 添加 Node ID
          </button>
        </div>
      </div>

      <div>
        <label className={labelClass}>Data Type</label>
        <input className={inputClass} value={endpoint.dataType ?? ""} onChange={(e) => update({ dataType: e.target.value })} placeholder="Double, String, etc." />
      </div>

      <div>
        <label className={labelClass}>描述</label>
        <input className={inputClass} value={endpoint.description ?? ""} onChange={(e) => update({ description: e.target.value })} />
      </div>
    </div>
  )
}
