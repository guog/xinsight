"use client"

import { Trash2 } from "lucide-react"
import type { MqttEndpoint } from "@/mastra/tools/datasource/types"

const inputClass =
  "w-full px-3 py-2 text-sm rounded-lg border border-border bg-transparent focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
const labelClass = "block text-sm font-medium mb-1"

interface Props {
  endpoint: MqttEndpoint
  onChange: (ep: MqttEndpoint) => void
  onRemove: () => void
}

const directions = ["publish", "subscribe", "both"] as const
const payloadFormats = ["json", "text", "binary"] as const

export default function MqttEndpointForm({ endpoint, onChange, onRemove }: Props) {
  const update = (partial: Partial<MqttEndpoint>) =>
    onChange({ ...endpoint, ...partial } as MqttEndpoint)

  return (
    <div className="border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{endpoint.topic || "MQTT 接口"}</span>
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
          />
        </div>
        <div>
          <label className={labelClass}>名称</label>
          <input
            className={inputClass}
            value={endpoint.name}
            onChange={(e) => update({ name: e.target.value })}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>Topic</label>
        <input
          className={inputClass}
          value={endpoint.topic}
          onChange={(e) => update({ topic: e.target.value })}
          placeholder="sensors/temperature/#"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className={labelClass}>Direction</label>
          <select
            className={inputClass}
            value={endpoint.direction}
            onChange={(e) => update({ direction: e.target.value as MqttEndpoint["direction"] })}
          >
            {directions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>QoS</label>
          <select
            className={inputClass}
            value={endpoint.qos}
            onChange={(e) => update({ qos: Number(e.target.value) as 0 | 1 | 2 })}
          >
            <option value={0}>0 - At most once</option>
            <option value={1}>1 - At least once</option>
            <option value={2}>2 - Exactly once</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Payload Format</label>
          <select
            className={inputClass}
            value={endpoint.payloadFormat}
            onChange={(e) =>
              update({ payloadFormat: e.target.value as MqttEndpoint["payloadFormat"] })
            }
          >
            {payloadFormats.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
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
