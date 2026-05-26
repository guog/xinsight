"use client"

import { Trash2, Plus } from "lucide-react"
import type { RestEndpoint } from "@/mastra/tools/datasource/types"

const inputClass =
  "w-full px-3 py-2 text-sm rounded-lg border border-border bg-transparent focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
const labelClass = "block text-sm font-medium mb-1"

interface Props {
  endpoint: RestEndpoint
  onChange: (ep: RestEndpoint) => void
  onRemove: () => void
}

const methods = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const

export default function RestEndpointForm({ endpoint, onChange, onRemove }: Props) {
  const update = (partial: Partial<RestEndpoint>) =>
    onChange({ ...endpoint, ...partial } as RestEndpoint)

  const queryParams = endpoint.queryParams ?? {}
  const queryEntries = Object.entries(queryParams)

  const addQueryParam = () => {
    update({ queryParams: { ...queryParams, "": "" } })
  }

  const removeQueryParam = (key: string) => {
    const next = { ...queryParams }
    delete next[key]
    update({ queryParams: next })
  }

  const updateQueryParam = (oldKey: string, newKey: string, value: string) => {
    const entries = Object.entries(queryParams)
    const next: Record<string, string> = {}
    for (const [k, v] of entries) {
      if (k === oldKey) next[newKey] = value
      else next[k] = v
    }
    update({ queryParams: next })
  }

  return (
    <div className="border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{endpoint.name || endpoint.path || "REST 接口"}</span>
        <button
          type="button"
          onClick={onRemove}
          className="p-1 rounded hover:bg-muted text-red-500 transition-colors"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <label className={labelClass}>Method</label>
          <select
            className={inputClass}
            value={endpoint.method}
            onChange={(e) => update({ method: e.target.value as RestEndpoint["method"] })}
          >
            {methods.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-3">
          <label className={labelClass}>Path</label>
          <input
            className={inputClass}
            value={endpoint.path}
            onChange={(e) => update({ path: e.target.value })}
            placeholder="/api/resource/{id}"
          />
        </div>
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

      {/* Query Params */}
      <div>
        <label className={labelClass}>Query 参数</label>
        <div className="space-y-2">
          {queryEntries.map(([key, value], i) => (
            <div key={i} className="flex gap-2">
              <input
                className={inputClass}
                value={key}
                onChange={(e) => updateQueryParam(key, e.target.value, value)}
                placeholder="key"
              />
              <input
                className={inputClass}
                value={value}
                onChange={(e) => updateQueryParam(key, key, e.target.value)}
                placeholder="value"
              />
              <button
                type="button"
                onClick={() => removeQueryParam(key)}
                className="p-1 text-red-500 hover:bg-muted rounded"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addQueryParam}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Plus className="size-3" /> 添加参数
          </button>
        </div>
      </div>

      <div>
        <label className={labelClass}>Request Body</label>
        <textarea
          className={`${inputClass} min-h-[60px] font-mono`}
          value={endpoint.requestBody ?? ""}
          onChange={(e) => update({ requestBody: e.target.value })}
          placeholder='{"key": "value"}'
          rows={3}
        />
      </div>

      <div>
        <label className={labelClass}>响应示例</label>
        <textarea
          className={`${inputClass} min-h-[60px] font-mono`}
          value={endpoint.responseExample ?? ""}
          onChange={(e) => update({ responseExample: e.target.value })}
          rows={2}
        />
      </div>

      <div>
        <label className={labelClass}>描述</label>
        <input
          className={inputClass}
          value={endpoint.description ?? ""}
          onChange={(e) => update({ description: e.target.value })}
          placeholder="接口描述"
        />
      </div>
    </div>
  )
}
