"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { Datasource, DatasourceEndpoint } from "@/hooks/use-datasources"
import { Plus, Trash2 } from "lucide-react"

// 接入协议选项
const protocolOptions = [
  { value: "rest", label: "REST API" },
  { value: "graphql", label: "GraphQL" },
  { value: "grpc", label: "gRPC" },
  { value: "opcua", label: "OPC UA" },
  { value: "mqtt", label: "MQTT" },
] as const

// 认证方式选项
const authOptions = [
  { value: "none", label: "无认证" },
  { value: "bearer", label: "Bearer Token" },
  { value: "basic", label: "Basic Auth" },
  { value: "apikey", label: "API Key" },
] as const

// Agent 列表
const agentOptions = [
  { id: "chat-agent", label: "Chat Agent" },
  { id: "research-agent", label: "Research Agent" },
  { id: "code-agent", label: "Code Agent" },
]

type ProtocolType = Datasource["type"]
type AuthType = "none" | "bearer" | "basic" | "apikey"

interface Props {
  initialData?: Datasource & { agents?: string[] }
  isEdit?: boolean
}

function emptyEndpoint(): DatasourceEndpoint {
  return { id: "", name: "", description: "", paramSchema: "", responseExample: "" }
}

export default function DatasourceForm({ initialData, isEdit }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  // 基本信息
  const [id, setId] = useState(initialData?.id ?? "")
  const [name, setName] = useState(initialData?.name ?? "")
  const [description, setDescription] = useState(initialData?.description ?? "")
  const [enabled, setEnabled] = useState(initialData?.enabled ?? true)

  // 协议
  const [type, setType] = useState<ProtocolType>(initialData?.type ?? "rest")

  // 连接配置
  const [config, setConfig] = useState<Record<string, string>>({
    baseUrl: "",
    endpoint: "",
    address: "",
    endpointUrl: "",
    brokerUrl: "",
    defaultTopic: "",
    timeout: "30000",
    ...(initialData?.config as Record<string, string> | undefined),
  })

  // 认证
  const [authType, setAuthType] = useState<AuthType>(
    (initialData?.auth?.type as AuthType) ?? "none",
  )
  const [auth, setAuth] = useState<Record<string, string>>({
    token: "",
    username: "",
    password: "",
    apiKey: "",
    headerName: "X-API-Key",
    ...(initialData?.auth as Record<string, string> | undefined),
  })

  // 接口定义
  const [endpoints, setEndpoints] = useState<DatasourceEndpoint[]>(
    initialData?.endpoints ?? [emptyEndpoint()],
  )

  // Agent 绑定
  const [boundAgents, setBoundAgents] = useState<Set<string>>(new Set(initialData?.agents ?? []))

  const updateConfig = (key: string, value: string) => setConfig((c) => ({ ...c, [key]: value }))
  const updateAuth = (key: string, value: string) => setAuth((a) => ({ ...a, [key]: value }))

  const updateEndpoint = (index: number, field: keyof DatasourceEndpoint, value: string) => {
    setEndpoints((prev) => prev.map((ep, i) => (i === index ? { ...ep, [field]: value } : ep)))
  }

  const addEndpoint = () => setEndpoints((prev) => [...prev, emptyEndpoint()])
  const removeEndpoint = (index: number) =>
    setEndpoints((prev) => prev.filter((_, i) => i !== index))

  const toggleAgent = (agentId: string) => {
    setBoundAgents((prev) => {
      const next = new Set(prev)
      if (next.has(agentId)) next.delete(agentId)
      else next.add(agentId)
      return next
    })
  }

  // 提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const body = {
        id,
        name,
        description,
        enabled,
        type,
        config: { ...config, timeout: Number(config.timeout) },
        auth: authType === "none" ? undefined : { type: authType, ...auth },
        endpoints: endpoints.filter((ep) => ep.id || ep.name),
      }

      const url = isEdit ? `/api/datasources/${id}` : "/api/datasources"
      const method = isEdit ? "PUT" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || "保存失败")
      }

      const dsId = isEdit ? id : ((await res.json()).id ?? id)

      // 处理 Agent 绑定
      const prevAgents = new Set(initialData?.agents ?? [])
      const toAdd = [...boundAgents].filter((a) => !prevAgents.has(a))
      const toRemove = [...prevAgents].filter((a) => !boundAgents.has(a))

      await Promise.all([
        ...toAdd.map((agentId) =>
          fetch(`/api/datasources/${dsId}/agents`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ agentId }),
          }),
        ),
        ...toRemove.map((agentId) =>
          fetch(`/api/datasources/${dsId}/agents`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ agentId }),
          }),
        ),
      ])

      router.push("/admin/datasources")
    } catch (err) {
      alert(err instanceof Error ? err.message : "保存失败")
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    "w-full px-3 py-2 text-sm rounded-lg border border-border bg-transparent focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
  const labelClass = "block text-sm font-medium mb-1"
  const sectionClass = "mb-8"
  const sectionTitleClass = "text-sm font-medium text-muted-foreground mb-3"

  // 根据协议类型显示的连接配置字段
  const connectionFields: Record<ProtocolType, { key: string; label: string }[]> = {
    rest: [{ key: "baseUrl", label: "Base URL" }],
    graphql: [{ key: "endpoint", label: "Endpoint" }],
    grpc: [{ key: "address", label: "Address" }],
    opcua: [{ key: "endpointUrl", label: "Endpoint URL" }],
    mqtt: [
      { key: "brokerUrl", label: "Broker URL" },
      { key: "defaultTopic", label: "Default Topic" },
    ],
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-0">
      {/* 基本信息 */}
      <section className={sectionClass}>
        <h2 className={sectionTitleClass}>基本信息</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>ID</label>
            <input
              className={inputClass}
              value={id}
              onChange={(e) => setId(e.target.value)}
              readOnly={isEdit}
              required
              placeholder="唯一标识符，如 my-api"
            />
          </div>
          <div>
            <label className={labelClass}>名称</label>
            <input
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="数据源名称"
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>描述</label>
            <input
              className={inputClass}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="可选描述"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enabled"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="enabled" className="text-sm">
              启用
            </label>
          </div>
        </div>
      </section>

      {/* 接入协议 */}
      <section className={sectionClass}>
        <h2 className={sectionTitleClass}>接入协议</h2>
        <div className="flex flex-wrap gap-2">
          {protocolOptions.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setType(value)}
              className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                type === value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:bg-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* 连接配置 */}
      <section className={sectionClass}>
        <h2 className={sectionTitleClass}>连接配置</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {connectionFields[type].map(({ key, label }) => (
            <div key={key}>
              <label className={labelClass}>{label}</label>
              <input
                className={inputClass}
                value={config[key] ?? ""}
                onChange={(e) => updateConfig(key, e.target.value)}
                placeholder={label}
              />
            </div>
          ))}
          <div>
            <label className={labelClass}>超时时间 (ms)</label>
            <input
              className={inputClass}
              type="number"
              value={config.timeout}
              onChange={(e) => updateConfig("timeout", e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* 认证方式 */}
      <section className={sectionClass}>
        <h2 className={sectionTitleClass}>认证方式</h2>
        <div className="flex flex-wrap gap-2 mb-4">
          {authOptions.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setAuthType(value)}
              className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                authType === value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:bg-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {authType === "bearer" && (
          <div>
            <label className={labelClass}>Token</label>
            <input
              className={inputClass}
              value={auth.token}
              onChange={(e) => updateAuth("token", e.target.value)}
              placeholder="Bearer token"
            />
          </div>
        )}
        {authType === "basic" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>用户名</label>
              <input
                className={inputClass}
                value={auth.username}
                onChange={(e) => updateAuth("username", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>密码</label>
              <input
                className={inputClass}
                type="password"
                value={auth.password}
                onChange={(e) => updateAuth("password", e.target.value)}
              />
            </div>
          </div>
        )}
        {authType === "apikey" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Header 名称</label>
              <input
                className={inputClass}
                value={auth.headerName}
                onChange={(e) => updateAuth("headerName", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>API Key</label>
              <input
                className={inputClass}
                value={auth.apiKey}
                onChange={(e) => updateAuth("apiKey", e.target.value)}
              />
            </div>
          </div>
        )}
      </section>

      {/* 接口定义 */}
      <section className={sectionClass}>
        <h2 className={sectionTitleClass}>接口定义 (Endpoints)</h2>
        <div className="space-y-4">
          {endpoints.map((ep, i) => (
            <div key={i} className="border border-border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">接口 #{i + 1}</span>
                {endpoints.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeEndpoint(i)}
                    className="p-1 rounded hover:bg-muted text-red-500 transition-colors"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className={labelClass}>ID</label>
                  <input
                    className={inputClass}
                    value={ep.id}
                    onChange={(e) => updateEndpoint(i, "id", e.target.value)}
                    placeholder="接口 ID"
                  />
                </div>
                <div>
                  <label className={labelClass}>名称</label>
                  <input
                    className={inputClass}
                    value={ep.name}
                    onChange={(e) => updateEndpoint(i, "name", e.target.value)}
                    placeholder="接口名称"
                  />
                </div>
                <div>
                  <label className={labelClass}>描述</label>
                  <input
                    className={inputClass}
                    value={ep.description ?? ""}
                    onChange={(e) => updateEndpoint(i, "description", e.target.value)}
                    placeholder="接口描述"
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>入参说明 (paramSchema)</label>
                <textarea
                  className={`${inputClass} min-h-[60px]`}
                  value={ep.paramSchema ?? ""}
                  onChange={(e) => updateEndpoint(i, "paramSchema", e.target.value)}
                  placeholder='如: { "city": "string" }'
                  rows={2}
                />
              </div>
              <div>
                <label className={labelClass}>响应示例 (responseExample)</label>
                <textarea
                  className={`${inputClass} min-h-[60px]`}
                  value={ep.responseExample ?? ""}
                  onChange={(e) => updateEndpoint(i, "responseExample", e.target.value)}
                  placeholder='如: { "temperature": 25 }'
                  rows={2}
                />
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addEndpoint}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-dashed border-border hover:bg-muted transition-colors"
          >
            <Plus className="size-4" />
            添加接口
          </button>
        </div>
      </section>

      {/* Agent 绑定 */}
      <section className={sectionClass}>
        <h2 className={sectionTitleClass}>Agent 绑定</h2>
        <div className="flex flex-wrap gap-4">
          {agentOptions.map(({ id: agentId, label }) => (
            <label key={agentId} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={boundAgents.has(agentId)}
                onChange={() => toggleAgent(agentId)}
                className="rounded"
              />
              {label}
            </label>
          ))}
        </div>
      </section>

      {/* 提交 */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2 rounded-lg bg-primary text-primary-foreground text-sm transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? "保存中..." : isEdit ? "保存修改" : "创建数据源"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/datasources")}
          className="px-6 py-2 rounded-lg border border-border text-sm transition-colors hover:bg-muted"
        >
          取消
        </button>
      </div>
    </form>
  )
}
