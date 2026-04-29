"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { Datasource, DatasourceEndpoint } from "@/hooks/use-datasources"
import type {
  RestEndpoint,
  GraphqlEndpoint,
  GrpcEndpoint,
  OpcuaEndpoint,
  MqttEndpoint,
} from "@/mastra/tools/datasource/types"
import { useAgents } from "@/hooks/use-agents"
import { Plus, Loader2, Download, Search } from "lucide-react"
import { toast } from "sonner"

import RestEndpointForm from "@/components/datasource/rest-endpoint-form"
import GraphqlEndpointForm from "@/components/datasource/graphql-endpoint-form"
import GrpcEndpointForm from "@/components/datasource/grpc-endpoint-form"
import OpcuaEndpointForm from "@/components/datasource/opcua-endpoint-form"
import MqttEndpointForm from "@/components/datasource/mqtt-endpoint-form"
import ConnectionTestButton from "@/components/datasource/connection-test-button"
import OpenApiImportDialog from "@/components/datasource/openapi-import-dialog"

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

type ProtocolType = Datasource["type"]
type AuthType = "none" | "bearer" | "basic" | "apikey"

interface Props {
  initialData?: Datasource & { agents?: string[] }
  isEdit?: boolean
}

function emptyRestEndpoint(): RestEndpoint {
  return { id: "", name: "", method: "GET", path: "", description: "", apiSchemaFormat: "natural" }
}

function emptyGraphqlEndpoint(): GraphqlEndpoint {
  return { id: "", name: "", operationType: "query", operationName: "", query: "", description: "", apiSchemaFormat: "natural" }
}

function emptyGrpcEndpoint(): GrpcEndpoint {
  return { id: "", name: "", service: "", method: "", description: "", apiSchemaFormat: "natural" }
}

function emptyOpcuaEndpoint(): OpcuaEndpoint {
  return { id: "", name: "", action: "read", nodeIds: [""], description: "", apiSchemaFormat: "natural" }
}

function emptyMqttEndpoint(): MqttEndpoint {
  return { id: "", name: "", topic: "", direction: "subscribe", qos: 0, payloadFormat: "json", description: "", apiSchemaFormat: "natural" }
}

export default function DatasourceForm({ initialData, isEdit }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const { agents: agentOptions, loading: agentsLoading } = useAgents()

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

  // 协议特定 endpoints
  const [restEndpoints, setRestEndpoints] = useState<RestEndpoint[]>(() => {
    if (initialData?.type === "rest" && initialData.endpoints?.length) {
      return initialData.endpoints as unknown as RestEndpoint[]
    }
    return []
  })
  const [graphqlEndpoints, setGraphqlEndpoints] = useState<GraphqlEndpoint[]>(() => {
    if (initialData?.type === "graphql" && initialData.endpoints?.length) {
      return initialData.endpoints as unknown as GraphqlEndpoint[]
    }
    return []
  })
  const [grpcEndpoints, setGrpcEndpoints] = useState<GrpcEndpoint[]>(() => {
    if (initialData?.type === "grpc" && initialData.endpoints?.length) {
      return initialData.endpoints as unknown as GrpcEndpoint[]
    }
    return []
  })
  const [opcuaEndpoints, setOpcuaEndpoints] = useState<OpcuaEndpoint[]>(() => {
    if (initialData?.type === "opcua" && initialData.endpoints?.length) {
      return initialData.endpoints as unknown as OpcuaEndpoint[]
    }
    return []
  })
  const [mqttEndpoints, setMqttEndpoints] = useState<MqttEndpoint[]>(() => {
    if (initialData?.type === "mqtt" && initialData.endpoints?.length) {
      return initialData.endpoints as unknown as MqttEndpoint[]
    }
    return []
  })

  // OpenAPI 导入对话框
  const [openApiDialogOpen, setOpenApiDialogOpen] = useState(false)

  // GraphQL 自省
  const [introspecting, setIntrospecting] = useState(false)

  // Agent 绑定
  const [boundAgents, setBoundAgents] = useState<Set<string>>(new Set(initialData?.agents ?? []))

  const updateConfig = (key: string, value: string) => setConfig((c) => ({ ...c, [key]: value }))
  const updateAuth = (key: string, value: string) => setAuth((a) => ({ ...a, [key]: value }))

  const toggleAgent = (agentId: string) => {
    setBoundAgents((prev) => {
      const next = new Set(prev)
      if (next.has(agentId)) next.delete(agentId)
      else next.add(agentId)
      return next
    })
  }

  // 获取当前协议的 endpoints（用于提交）
  const getCurrentEndpoints = (): DatasourceEndpoint[] => {
    const mapToGeneric = (eps: Array<Record<string, unknown>>): DatasourceEndpoint[] =>
      eps.filter((ep) => ep.id || ep.name).map((ep) => ({
        id: (ep.id as string) || "",
        name: (ep.name as string) || "",
        description: (ep.description as string) || "",
        paramSchema: (ep.paramSchema as string) || "",
        apiSchemaFormat: (ep.apiSchemaFormat as "natural" | "openapi") || "natural",
        responseExample: (ep.responseExample as string) || "",
        params: ep as Record<string, unknown>,
      }))

    switch (type) {
      case "rest": return mapToGeneric(restEndpoints as unknown as Record<string, unknown>[])
      case "graphql": return mapToGeneric(graphqlEndpoints as unknown as Record<string, unknown>[])
      case "grpc": return mapToGeneric(grpcEndpoints as unknown as Record<string, unknown>[])
      case "opcua": return mapToGeneric(opcuaEndpoints as unknown as Record<string, unknown>[])
      case "mqtt": return mapToGeneric(mqttEndpoints as unknown as Record<string, unknown>[])
      default: return []
    }
  }

  // GraphQL 自省
  const handleIntrospect = async () => {
    const ep = config.endpoint
    if (!ep) {
      toast.error("请先填写 GraphQL Endpoint")
      return
    }
    setIntrospecting(true)
    try {
      const res = await fetch("/api/datasources/introspect-graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: ep, headers: config.defaultHeaders }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "自省失败")
      }
      const result = await res.json()
      const all: GraphqlEndpoint[] = [
        ...(result.queries || []),
        ...(result.mutations || []),
        ...(result.subscriptions || []),
      ]
      setGraphqlEndpoints((prev) => [...prev, ...all])
      toast.success(`导入 ${all.length} 个 GraphQL 操作`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "自省失败")
    } finally {
      setIntrospecting(false)
    }
  }

  // 提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!id.trim()) { toast.error("请填写数据源 ID"); return }
    if (!name.trim()) { toast.error("请填写数据源名称"); return }

    setSaving(true)

    try {
      const body = {
        id,
        name,
        description,
        enabled,
        type,
        config: { ...config, timeout: Number(config.timeout) },
        auth: authType === "none" ? { type: "none" } : { type: authType, ...auth },
        endpoints: getCurrentEndpoints(),
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
      toast.success(isEdit ? "数据源已更新" : "数据源已创建")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存失败")
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

  // 构建测试连接用的 auth 对象
  const testAuth = authType === "none" ? { type: "none" as const } : { type: authType, ...auth }

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
      <details open className={sectionClass}>
        <summary className={`${sectionTitleClass} cursor-pointer select-none`}>连接配置</summary>
        <div className="grid gap-4 sm:grid-cols-2 mb-4">
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
        <ConnectionTestButton type={type} config={config} auth={testAuth} />
      </details>

      {/* 认证方式 */}
      <details open className={sectionClass}>
        <summary className={`${sectionTitleClass} cursor-pointer select-none`}>认证方式</summary>
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
      </details>

      {/* 接口定义 */}
      <details open className={sectionClass}>
        <summary className={`${sectionTitleClass} cursor-pointer select-none`}>
          接口定义 (Endpoints)
        </summary>

        {/* REST */}
        {type === "rest" && (
          <div className="space-y-4">
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => setOpenApiDialogOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-muted transition-colors"
              >
                <Download className="size-4" /> 导入 OpenAPI
              </button>
            </div>
            {restEndpoints.map((ep, i) => (
              <RestEndpointForm
                key={i}
                endpoint={ep}
                onChange={(updated) => setRestEndpoints((prev) => prev.map((e, idx) => (idx === i ? updated : e)))}
                onRemove={() => setRestEndpoints((prev) => prev.filter((_, idx) => idx !== i))}
              />
            ))}
            <button
              type="button"
              onClick={() => setRestEndpoints((prev) => [...prev, emptyRestEndpoint()])}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-dashed border-border hover:bg-muted transition-colors"
            >
              <Plus className="size-4" /> 添加 REST 接口
            </button>
          </div>
        )}

        {/* GraphQL */}
        {type === "graphql" && (
          <div className="space-y-4">
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={handleIntrospect}
                disabled={introspecting}
                className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50"
              >
                {introspecting ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                自省 Schema
              </button>
            </div>
            {graphqlEndpoints.map((ep, i) => (
              <GraphqlEndpointForm
                key={i}
                endpoint={ep}
                onChange={(updated) => setGraphqlEndpoints((prev) => prev.map((e, idx) => (idx === i ? updated : e)))}
                onRemove={() => setGraphqlEndpoints((prev) => prev.filter((_, idx) => idx !== i))}
              />
            ))}
            <button
              type="button"
              onClick={() => setGraphqlEndpoints((prev) => [...prev, emptyGraphqlEndpoint()])}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-dashed border-border hover:bg-muted transition-colors"
            >
              <Plus className="size-4" /> 添加 GraphQL 接口
            </button>
          </div>
        )}

        {/* gRPC */}
        {type === "grpc" && (
          <div className="space-y-4">
            {grpcEndpoints.map((ep, i) => (
              <GrpcEndpointForm
                key={i}
                endpoint={ep}
                onChange={(updated) => setGrpcEndpoints((prev) => prev.map((e, idx) => (idx === i ? updated : e)))}
                onRemove={() => setGrpcEndpoints((prev) => prev.filter((_, idx) => idx !== i))}
              />
            ))}
            <button
              type="button"
              onClick={() => setGrpcEndpoints((prev) => [...prev, emptyGrpcEndpoint()])}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-dashed border-border hover:bg-muted transition-colors"
            >
              <Plus className="size-4" /> 添加 gRPC 接口
            </button>
          </div>
        )}

        {/* OPC UA */}
        {type === "opcua" && (
          <div className="space-y-4">
            {opcuaEndpoints.map((ep, i) => (
              <OpcuaEndpointForm
                key={i}
                endpoint={ep}
                onChange={(updated) => setOpcuaEndpoints((prev) => prev.map((e, idx) => (idx === i ? updated : e)))}
                onRemove={() => setOpcuaEndpoints((prev) => prev.filter((_, idx) => idx !== i))}
              />
            ))}
            <button
              type="button"
              onClick={() => setOpcuaEndpoints((prev) => [...prev, emptyOpcuaEndpoint()])}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-dashed border-border hover:bg-muted transition-colors"
            >
              <Plus className="size-4" /> 添加 OPC UA 接口
            </button>
          </div>
        )}

        {/* MQTT */}
        {type === "mqtt" && (
          <div className="space-y-4">
            {mqttEndpoints.map((ep, i) => (
              <MqttEndpointForm
                key={i}
                endpoint={ep}
                onChange={(updated) => setMqttEndpoints((prev) => prev.map((e, idx) => (idx === i ? updated : e)))}
                onRemove={() => setMqttEndpoints((prev) => prev.filter((_, idx) => idx !== i))}
              />
            ))}
            <button
              type="button"
              onClick={() => setMqttEndpoints((prev) => [...prev, emptyMqttEndpoint()])}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-dashed border-border hover:bg-muted transition-colors"
            >
              <Plus className="size-4" /> 添加 MQTT 接口
            </button>
          </div>
        )}
      </details>

      {/* Agent 绑定 */}
      <details open className={sectionClass}>
        <summary className={`${sectionTitleClass} cursor-pointer select-none`}>Agent 绑定</summary>
        {agentsLoading ? (
          <p className="text-sm text-muted-foreground">加载 Agent 列表...</p>
        ) : (
          <div className="flex flex-wrap gap-4">
            {agentOptions.map(({ id: agentId, name: agentName }) => (
              <label key={agentId} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={boundAgents.has(agentId)}
                  onChange={() => toggleAgent(agentId)}
                  className="rounded"
                />
                {agentName} ({agentId})
              </label>
            ))}
          </div>
        )}
      </details>

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

      {/* OpenAPI 导入对话框 */}
      <OpenApiImportDialog
        open={openApiDialogOpen}
        onClose={() => setOpenApiDialogOpen(false)}
        onImport={(result) => {
          setRestEndpoints((prev) => [...prev, ...result.endpoints])
          if (result.baseUrl) updateConfig("baseUrl", result.baseUrl)
          toast.success(`已导入 ${result.endpoints.length} 个接口`)
        }}
      />
    </form>
  )
}
