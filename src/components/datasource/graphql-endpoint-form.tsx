"use client"

import { Trash2 } from "lucide-react"
import type { GraphqlEndpoint } from "@/mastra/tools/datasource/types"

const inputClass =
  "w-full px-3 py-2 text-sm rounded-lg border border-border bg-transparent focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
const labelClass = "block text-sm font-medium mb-1"

interface Props {
  endpoint: GraphqlEndpoint
  onChange: (ep: GraphqlEndpoint) => void
  onRemove: () => void
}

const operationTypes = ["query", "mutation", "subscription"] as const

export default function GraphqlEndpointForm({ endpoint, onChange, onRemove }: Props) {
  const update = (partial: Partial<GraphqlEndpoint>) => onChange({ ...endpoint, ...partial } as GraphqlEndpoint)

  return (
    <div className="border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{endpoint.operationName || "GraphQL 接口"}</span>
        <button type="button" onClick={onRemove} className="p-1 rounded hover:bg-muted text-red-500 transition-colors">
          <Trash2 className="size-4" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className={labelClass}>操作类型</label>
          <select
            className={inputClass}
            value={endpoint.operationType}
            onChange={(e) => update({ operationType: e.target.value as GraphqlEndpoint["operationType"] })}
          >
            {operationTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Operation Name</label>
          <input className={inputClass} value={endpoint.operationName} onChange={(e) => update({ operationName: e.target.value })} />
        </div>
        <div>
          <label className={labelClass}>ID</label>
          <input className={inputClass} value={endpoint.id} onChange={(e) => update({ id: e.target.value })} placeholder="接口 ID" />
        </div>
      </div>

      <div>
        <label className={labelClass}>名称</label>
        <input className={inputClass} value={endpoint.name} onChange={(e) => update({ name: e.target.value })} placeholder="接口名称" />
      </div>

      <div>
        <label className={labelClass}>Query</label>
        <textarea
          className={`${inputClass} min-h-[80px] font-mono`}
          value={endpoint.query}
          onChange={(e) => update({ query: e.target.value })}
          placeholder="query GetUser($id: ID!) { user(id: $id) { name } }"
          rows={4}
        />
      </div>

      <div>
        <label className={labelClass}>Variables Schema</label>
        <textarea
          className={`${inputClass} min-h-[60px] font-mono`}
          value={endpoint.variables ?? ""}
          onChange={(e) => update({ variables: e.target.value })}
          placeholder='{"id": "string"}'
          rows={2}
        />
      </div>

      <div>
        <label className={labelClass}>描述</label>
        <input className={inputClass} value={endpoint.description ?? ""} onChange={(e) => update({ description: e.target.value })} />
      </div>
    </div>
  )
}
