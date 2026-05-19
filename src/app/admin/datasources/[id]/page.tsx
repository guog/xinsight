"use client"

import { useState, useEffect, useDeferredValue } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Loader2, Pencil, Zap, ArrowLeft, Globe, Key, Server, Search } from "lucide-react"
import { filterEndpoints } from "@/lib/endpoint-filter"
import { toast } from "sonner"

interface Endpoint {
  id: string
  name: string
  path?: string
  method?: string
  description: string
  paramSchema: string
  apiSchemaFormat: string
  responseExample: string
}

interface Datasource {
  id: string
  name: string
  description: string
  type: string
  enabled: boolean
  config: Record<string, unknown>
  auth?: { type: string; [key: string]: unknown }
  endpoints: Endpoint[]
  createdAt: string
  updatedAt: string
}

export default function DatasourceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [ds, setDs] = useState<Datasource | null>(null)
  const [loading, setLoading] = useState(true)
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "ok" | "failed">("idle")
  const [endpointSearch, setEndpointSearch] = useState("")
  const deferredEndpointSearch = useDeferredValue(endpointSearch)
  const [testDetails, setTestDetails] = useState<{
    statusCode?: number
    latency?: number
    responsePreview?: string
    diagnosis?: string
  } | null>(null)

  useEffect(() => {
    fetch(`/api/datasources/${id}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("加载失败"))))
      .then((data) => {
        setDs({
          ...data,
          config: typeof data.config === "string" ? JSON.parse(data.config) : data.config,
          auth: data.auth
            ? typeof data.auth === "string"
              ? JSON.parse(data.auth)
              : data.auth
            : undefined,
          endpoints:
            typeof data.endpoints === "string"
              ? JSON.parse(data.endpoints)
              : (data.endpoints ?? []),
        })
      })
      .catch(() => toast.error("加载数据源详情失败"))
      .finally(() => setLoading(false))
  }, [id])

  const handleTest = async () => {
    setTestStatus("testing")
    setTestDetails(null)
    try {
      const res = await fetch(`/api/datasources/${id}/test`, { method: "POST" })
      const data = await res.json()
      setTestStatus(data.ok ? "ok" : "failed")
      setTestDetails({
        statusCode: data.statusCode,
        latency: data.latency,
        responsePreview: data.responsePreview,
        diagnosis: data.diagnosis,
      })
      toast[data.ok ? "success" : "error"](
        data.ok ? `连接成功 (${data.latency ?? 0}ms)` : data.diagnosis || "连接失败",
      )
    } catch {
      setTestStatus("failed")
      toast.error("测试连接失败")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!ds) {
    return <div className="text-center py-20 text-sm text-muted-foreground">数据源不存在</div>
  }

  const typeBadge: Record<string, string> = {
    rest: "bg-primary/10 text-primary",
    graphql: "bg-accent text-accent-foreground",
    grpc: "bg-primary/10 text-primary",
    opcua: "bg-accent text-accent-foreground",
    mqtt: "bg-primary/10 text-primary",
  }

  return (
    <div className="animate-in fade-in duration-300 space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/datasources"
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-medium">{ds.name}</h2>
              <span
                className={`px-2 py-0.5 text-xs rounded-full ${typeBadge[ds.type] ?? "bg-muted text-muted-foreground"}`}
              >
                {ds.type.toUpperCase()}
              </span>
              <span
                className={`px-2 py-0.5 text-xs rounded-full ${ds.enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
              >
                {ds.enabled ? "启用" : "禁用"}
              </span>
            </div>
            {ds.description && (
              <p className="text-sm text-muted-foreground mt-0.5">{ds.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleTest}
            disabled={testStatus === "testing"}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50"
          >
            {testStatus === "testing" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Zap className="size-3.5" />
            )}
            测试连接
          </button>
          <Link
            href={`/admin/datasources/${id}/edit`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Pencil className="size-3.5" />
            编辑
          </Link>
        </div>
      </div>
      {testDetails && (
        <div
          className={`mt-3 p-3 rounded-lg border text-xs space-y-1 ${
            testStatus === "ok"
              ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950"
              : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950"
          }`}
        >
          <div className="flex gap-4">
            {testDetails.statusCode && (
              <span>
                状态码: <strong>{testDetails.statusCode}</strong>
              </span>
            )}
            {testDetails.latency !== undefined && (
              <span>
                延迟: <strong>{testDetails.latency}ms</strong>
              </span>
            )}
          </div>
          {testDetails.diagnosis && (
            <p className="text-muted-foreground">诊断: {testDetails.diagnosis}</p>
          )}
          {testDetails.responsePreview && (
            <details>
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                响应预览
              </summary>
              <pre className="mt-1 p-2 bg-muted rounded overflow-x-auto max-h-32">
                {testDetails.responsePreview}
              </pre>
            </details>
          )}
        </div>
      )}

      {/* 连接配置 */}
      <section className="bg-card border border-border rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Globe className="size-4" /> 连接配置
        </h3>
        <div className="grid gap-2 text-sm">
          {Object.entries(ds.config).map(([key, value]) => (
            <div key={key} className="flex gap-2">
              <span className="text-muted-foreground min-w-[120px]">{key}</span>
              <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded break-all">
                {String(value)}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* 认证信息 */}
      {ds.auth && ds.auth.type !== "none" && (
        <section className="bg-card border border-border rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Key className="size-4" /> 认证配置
          </h3>
          <div className="text-sm">
            <span className="text-muted-foreground">认证方式：</span>
            <span className="ml-2 font-medium">{ds.auth.type}</span>
          </div>
        </section>
      )}

      {/* 接口列表 */}
      <section className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Server className="size-4" /> 接口定义 (
            {filterEndpoints(ds.endpoints, deferredEndpointSearch).length}
            {deferredEndpointSearch && `/${ds.endpoints.length}`})
          </h3>
          {ds.endpoints.length > 0 && (
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <input
                type="text"
                value={endpointSearch}
                onChange={(e) => setEndpointSearch(e.target.value)}
                placeholder="搜索接口..."
                className="pl-8 pr-3 py-1.5 text-xs border border-border rounded-md bg-background w-48 focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          )}
        </div>
        {ds.endpoints.length === 0 ? (
          <p className="text-sm text-muted-foreground">未定义接口</p>
        ) : (
          <div className="space-y-3">
            {filterEndpoints(ds.endpoints, deferredEndpointSearch).length === 0 &&
              deferredEndpointSearch && (
                <p className="text-sm text-muted-foreground py-2">无匹配接口</p>
              )}
            {filterEndpoints(ds.endpoints, deferredEndpointSearch).map((ep, i) => (
              <div key={ep.id || i} className="border border-border rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{ep.name || ep.id || `接口 ${i + 1}`}</span>
                  {ep.apiSchemaFormat && (
                    <span className="text-xs text-muted-foreground px-1.5 py-0.5 bg-muted rounded">
                      {ep.apiSchemaFormat}
                    </span>
                  )}
                </div>
                {ep.description && (
                  <p className="text-xs text-muted-foreground">{ep.description}</p>
                )}
                {ep.paramSchema && (
                  <div>
                    <span className="text-xs text-muted-foreground">参数：</span>
                    <pre className="mt-1 text-xs bg-muted p-2 rounded overflow-x-auto">
                      {ep.paramSchema}
                    </pre>
                  </div>
                )}
                {!!(ep as unknown as Record<string, unknown>).structuredParams && (
                  <div>
                    <span className="text-xs text-muted-foreground">结构化参数：</span>
                    <div className="mt-1 space-y-0.5">
                      {(
                        (ep as unknown as Record<string, unknown>).structuredParams as Array<{
                          name: string
                          type: string
                          required?: boolean
                          description?: string
                          enum?: string[]
                          format?: string
                          example?: unknown
                        }>
                      ).map((p, pi) => (
                        <div key={pi} className="text-xs flex items-center gap-1.5">
                          <code className="bg-muted px-1 rounded">{p.name}</code>
                          <span className="text-muted-foreground">{p.type}</span>
                          {p.required && <span className="text-red-500 text-[10px]">必填</span>}
                          {p.description && (
                            <span className="text-muted-foreground">- {p.description}</span>
                          )}
                          {p.enum && (
                            <span className="text-muted-foreground">
                              [可选: {p.enum.join(", ")}]
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {ep.responseExample && (
                  <div>
                    <span className="text-xs text-muted-foreground">响应示例：</span>
                    <pre className="mt-1 text-xs bg-muted p-2 rounded overflow-x-auto">
                      {ep.responseExample}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
