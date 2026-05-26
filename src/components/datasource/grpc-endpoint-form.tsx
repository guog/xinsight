"use client"

import { Trash2 } from "lucide-react"
import type { GrpcEndpoint } from "@/mastra/tools/datasource/types"

const inputClass =
  "w-full px-3 py-2 text-sm rounded-lg border border-border bg-transparent focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
const labelClass = "block text-sm font-medium mb-1"

interface Props {
  endpoint: GrpcEndpoint
  onChange: (ep: GrpcEndpoint) => void
  onRemove: () => void
}

export default function GrpcEndpointForm({ endpoint, onChange, onRemove }: Props) {
  const update = (partial: Partial<GrpcEndpoint>) =>
    onChange({ ...endpoint, ...partial } as GrpcEndpoint)

  return (
    <div className="border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          {endpoint.service ? `${endpoint.service}.${endpoint.method}` : "gRPC 接口"}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="p-1 rounded hover:bg-muted text-red-500 transition-colors"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>ID</label>
          <input
            className={inputClass}
            value={endpoint.id}
            onChange={(e) => update({ id: e.target.value })}
            placeholder="接口 ID"
          />
        </div>
        <div>
          <label className={labelClass}>名称</label>
          <input
            className={inputClass}
            value={endpoint.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="接口名称"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Service</label>
          <input
            className={inputClass}
            value={endpoint.service}
            onChange={(e) => update({ service: e.target.value })}
            placeholder="com.example.UserService"
          />
        </div>
        <div>
          <label className={labelClass}>Method</label>
          <input
            className={inputClass}
            value={endpoint.method}
            onChange={(e) => update({ method: e.target.value })}
            placeholder="GetUser"
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>Request Message Schema</label>
        <textarea
          className={`${inputClass} min-h-[60px] font-mono`}
          value={endpoint.requestMessage ?? ""}
          onChange={(e) => update({ requestMessage: e.target.value })}
          rows={3}
        />
      </div>

      <div>
        <label className={labelClass}>Response Message Schema</label>
        <textarea
          className={`${inputClass} min-h-[60px] font-mono`}
          value={endpoint.responseMessage ?? ""}
          onChange={(e) => update({ responseMessage: e.target.value })}
          rows={3}
        />
      </div>

      <div>
        <label className={labelClass}>描述</label>
        <input
          className={inputClass}
          value={endpoint.description ?? ""}
          onChange={(e) => update({ description: e.target.value })}
        />
      </div>
    </div>
  )
}
