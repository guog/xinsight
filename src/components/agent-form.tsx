"use client"

import { useState, useEffect } from "react"
import { filterEndpoints } from "@/lib/endpoint-filter"
import type { AdminAgent } from "@/hooks/use-admin-agents"

interface Model {
  id: string
  name: string
  providerId: string
}

interface Endpoint {
  id: string
  name?: string
  path?: string
  method?: string
}

interface Datasource {
  id: string
  name: string
  type: string
  endpoints: string
}

export interface DatasourceBinding {
  datasourceId: string
  endpointIds: string[] | null
}

interface AgentFormProps {
  initialData?: Partial<AdminAgent>
  initialBindings?: DatasourceBinding[]
  onSubmit: (data: Record<string, unknown>) => Promise<void>
  isEdit?: boolean
}

export function AgentForm({ initialData, initialBindings, onSubmit, isEdit }: AgentFormProps) {
  const [id, setId] = useState(initialData?.id ?? "")
  const [name, setName] = useState(initialData?.name ?? "")
  const [description, setDescription] = useState(initialData?.description ?? "")
  const [systemPrompt, setSystemPrompt] = useState(initialData?.systemPrompt ?? "")
  const [modelId, setModelId] = useState(initialData?.modelId ?? "")
  const [icon, setIcon] = useState(initialData?.icon ?? "")
  const [enabled, setEnabled] = useState(initialData?.enabled ?? true)
  const [submitting, setSubmitting] = useState(false)
  const [validationError, setValidationError] = useState("")

  // Model selection state
  const [models, setModels] = useState<Model[]>([])
  const [modelsLoaded, setModelsLoaded] = useState(false)
  const [modelsFailed, setModelsFailed] = useState(false)

  // Datasource binding state
  const [datasources, setDatasources] = useState<Datasource[]>([])
  const [bindings, setBindings] = useState<DatasourceBinding[]>(initialBindings ?? [])
  const [endpointSearch, setEndpointSearch] = useState("")

  useEffect(() => {
    fetch("/api/admin/models")
      .then((res) => res.json())
      .then((data) => {
        if (data.models && data.models.length > 0) {
          setModels(data.models)
        } else {
          setModelsFailed(true)
        }
        setModelsLoaded(true)
      })
      .catch(() => {
        setModelsFailed(true)
        setModelsLoaded(true)
      })
  }, [])

  useEffect(() => {
    fetch("/api/datasources")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setDatasources(data)
        }
      })
      .catch(() => {
        // 静默失败
      })
  }, [])

  const getModelsByProvider = () => {
    const grouped: Record<string, Model[]> = {}
    for (const model of models) {
      if (!grouped[model.providerId]) {
        grouped[model.providerId] = []
      }
      grouped[model.providerId].push(model)
    }
    return grouped
  }

  const parseEndpoints = (endpointsJson: string): Endpoint[] => {
    try {
      return JSON.parse(endpointsJson)
    } catch {
      return []
    }
  }

  const isDatasourceChecked = (dsId: string) => {
    return bindings.some((b) => b.datasourceId === dsId)
  }

  const getBinding = (dsId: string) => {
    return bindings.find((b) => b.datasourceId === dsId)
  }

  const toggleDatasource = (dsId: string) => {
    if (isDatasourceChecked(dsId)) {
      setBindings(bindings.filter((b) => b.datasourceId !== dsId))
    } else {
      setBindings([...bindings, { datasourceId: dsId, endpointIds: null }])
    }
  }

  const isAllEndpoints = (dsId: string) => {
    const binding = getBinding(dsId)
    return binding?.endpointIds === null
  }

  const toggleAllEndpoints = (dsId: string) => {
    setBindings(
      bindings.map((b) =>
        b.datasourceId === dsId ? { ...b, endpointIds: b.endpointIds === null ? [] : null } : b,
      ),
    )
  }

  const isEndpointChecked = (dsId: string, epId: string) => {
    const binding = getBinding(dsId)
    if (!binding) return false
    if (binding.endpointIds === null) return true
    return binding.endpointIds.includes(epId)
  }

  const toggleEndpoint = (dsId: string, epId: string) => {
    setBindings(
      bindings.map((b) => {
        if (b.datasourceId !== dsId) return b
        if (b.endpointIds === null) {
          // 从全选切换到取消某个
          const ds = datasources.find((d) => d.id === dsId)
          const allEps = ds ? parseEndpoints(ds.endpoints).map((ep) => ep.id) : []
          return { ...b, endpointIds: allEps.filter((id) => id !== epId) }
        }
        if (b.endpointIds.includes(epId)) {
          return { ...b, endpointIds: b.endpointIds.filter((id) => id !== epId) }
        }
        return { ...b, endpointIds: [...b.endpointIds, epId] }
      }),
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setValidationError("")

    if (!isEdit && !id.trim()) {
      setValidationError("ID 不能为空")
      return
    }
    if (!isEdit && !/^[a-z0-9_-]+$/.test(id)) {
      setValidationError("ID 只能包含小写字母、数字、下划线和短横线")
      return
    }
    if (!name.trim()) {
      setValidationError("名称不能为空")
      return
    }

    setSubmitting(true)
    try {
      await onSubmit({
        ...(isEdit ? {} : { id }),
        name,
        ...(description ? { description } : {}),
        systemPrompt,
        modelId: modelId || null,
        ...(icon ? { icon } : {}),
        enabled,
        bindings,
      })
    } catch {
      // 错误由父组件处理
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {validationError && <p className="text-destructive text-sm">{validationError}</p>}

      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="agent-id">
          ID
        </label>
        <input
          id="agent-id"
          type="text"
          value={id}
          onChange={(e) => setId(e.target.value)}
          disabled={isEdit}
          placeholder="my-agent"
          className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm disabled:opacity-50"
        />
        <p className="text-muted-foreground text-xs">
          仅允许小写字母、数字、下划线和短横线 [a-z0-9_-]
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="agent-name">
          名称 <span className="text-destructive">*</span>
        </label>
        <input
          id="agent-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="agent-description">
          描述
        </label>
        <textarea
          id="agent-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="agent-system-prompt">
          系统提示词
        </label>
        <textarea
          id="agent-system-prompt"
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={8}
          className="border-input bg-background w-full rounded-md border px-3 py-2 font-mono text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="agent-model">
          模型
        </label>
        {modelsLoaded && !modelsFailed && models.length > 0 ? (
          <select
            id="agent-model"
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
          >
            <option value="">使用系统默认模型</option>
            {Object.entries(getModelsByProvider()).map(([providerId, providerModels]) => (
              <optgroup key={providerId} label={providerId}>
                {providerModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        ) : (
          <input
            id="agent-model"
            type="text"
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            placeholder="deepseek/deepseek-chat"
            className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
          />
        )}
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="agent-icon">
          图标
        </label>
        <input
          id="agent-icon"
          type="text"
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          placeholder="🤖"
          className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          id="agent-enabled"
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4 rounded border"
        />
        <label className="text-sm font-medium" htmlFor="agent-enabled">
          启用
        </label>
      </div>

      {/* 数据源绑定 */}
      {datasources.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">数据源绑定</label>
            <input
              type="text"
              value={endpointSearch}
              onChange={(e) => setEndpointSearch(e.target.value)}
              placeholder="搜索接口..."
              className="border-input bg-background rounded-md border px-2.5 py-1 text-xs w-44 focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="border-input rounded-md border p-3 space-y-3">
            {datasources.map((ds) => {
              const endpoints = parseEndpoints(ds.endpoints)
              const checked = isDatasourceChecked(ds.id)
              return (
                <div key={ds.id} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`ds-${ds.id}`}
                      checked={checked}
                      onChange={() => toggleDatasource(ds.id)}
                      className="h-4 w-4 rounded border"
                    />
                    <label htmlFor={`ds-${ds.id}`} className="text-sm font-medium">
                      {ds.name}
                    </label>
                    <span className="text-muted-foreground text-xs">({ds.type})</span>
                  </div>
                  {checked && endpoints.length > 0 && (
                    <div className="ml-6 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`ds-${ds.id}-all`}
                          checked={isAllEndpoints(ds.id)}
                          onChange={() => toggleAllEndpoints(ds.id)}
                          className="h-3.5 w-3.5 rounded border"
                        />
                        <label htmlFor={`ds-${ds.id}-all`} className="text-xs font-medium">
                          全部 Endpoints
                        </label>
                      </div>
                      {!isAllEndpoints(ds.id) &&
                        filterEndpoints(endpoints, endpointSearch).map((ep) => (
                          <div key={ep.id} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={`ep-${ds.id}-${ep.id}`}
                              checked={isEndpointChecked(ds.id, ep.id)}
                              onChange={() => toggleEndpoint(ds.id, ep.id)}
                              className="h-3.5 w-3.5 rounded border"
                            />
                            <label htmlFor={`ep-${ds.id}-${ep.id}`} className="text-xs">
                              {ep.name || ep.path || ep.id}
                            </label>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {submitting ? "提交中..." : isEdit ? "保存修改" : "创建 Agent"}
      </button>
    </form>
  )
}
