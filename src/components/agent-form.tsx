"use client"

import { useState, useEffect, useDeferredValue } from "react"
import { Search } from "lucide-react"
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

export interface AgentPermission {
  subjectType: "role" | "team" | "user"
  subjectId: string
  permissionType?: string
}

interface AgentFormProps {
  initialData?: Partial<AdminAgent>
  initialBindings?: DatasourceBinding[]
  initialPermissions?: AgentPermission[]
  onSubmit: (data: Record<string, unknown>) => Promise<void>
  isEdit?: boolean
}

export function AgentForm({
  initialData,
  initialBindings,
  initialPermissions,
  onSubmit,
  isEdit,
}: AgentFormProps) {
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
  const [endpointSearchMap, setEndpointSearchMap] = useState<Record<string, string>>({})
  const deferredSearchMap = useDeferredValue(endpointSearchMap)

  // 权限控制状态
  const [enablePermissionLimit, setEnablePermissionLimit] = useState(
    (initialPermissions ?? []).length > 0,
  )
  const [selectedRoles, setSelectedRoles] = useState<string[]>(
    initialPermissions?.filter((p) => p.subjectType === "role").map((p) => p.subjectId) ?? [],
  )
  const [selectedTeams, setSelectedTeams] = useState<string[]>(
    initialPermissions?.filter((p) => p.subjectType === "team").map((p) => p.subjectId) ?? [],
  )
  const [selectedUsers, setSelectedUsers] = useState<string[]>(
    initialPermissions?.filter((p) => p.subjectType === "user").map((p) => p.subjectId) ?? [],
  )

  const [systemUsers, setSystemUsers] = useState<
    { id: string; username: string; displayName: string }[]
  >([])
  const [systemTeams, setSystemTeams] = useState<
    { id: string; name: string; description: string }[]
  >([])

  useEffect(() => {
    fetch("/api/admin/users")
      .then((res) => res.json())
      .then((data) => {
        if (data.users) setSystemUsers(data.users)
      })
      .catch(() => {})

    fetch("/api/admin/teams")
      .then((res) => res.json())
      .then((data) => {
        if (data.teams) setSystemTeams(data.teams)
      })
      .catch(() => {})
  }, [])

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

  const isEndpointConfirmationChecked = (dsId: string, epId: string) => {
    const binding = getBinding(dsId)
    if (!binding) return false
    return binding.confirmationRequiredEndpoints?.includes(epId) ?? false
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
          // 取消选中时，也要在 confirmationRequired 列表中移除
          const currentConf = b.confirmationRequiredEndpoints ?? []
          return {
            ...b,
            endpointIds: b.endpointIds.filter((id) => id !== epId),
            confirmationRequiredEndpoints: currentConf.filter((id) => id !== epId),
          }
        }
        return { ...b, endpointIds: [...b.endpointIds, epId] }
      }),
    )
  }

  const toggleEndpointConfirmation = (dsId: string, epId: string) => {
    setBindings(
      bindings.map((b) => {
        if (b.datasourceId !== dsId) return b
        const currentConf = b.confirmationRequiredEndpoints ?? []
        if (currentConf.includes(epId)) {
          return {
            ...b,
            confirmationRequiredEndpoints: currentConf.filter((id) => id !== epId),
          }
        }
        return {
          ...b,
          confirmationRequiredEndpoints: [...currentConf, epId],
        }
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
      setValidationError("ID 只能包含小写字母、数字、下划线和连字符")
      return
    }
    if (!name.trim()) {
      setValidationError("名称不能为空")
      return
    }

    // 组装权限数据
    const permissions: AgentPermission[] = []
    if (enablePermissionLimit) {
      selectedRoles.forEach((role) =>
        permissions.push({ subjectType: "role", subjectId: role, permissionType: "use" }),
      )
      selectedTeams.forEach((teamId) =>
        permissions.push({ subjectType: "team", subjectId: teamId, permissionType: "use" }),
      )
      selectedUsers.forEach((userId) =>
        permissions.push({ subjectType: "user", subjectId: userId, permissionType: "use" }),
      )
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
        permissions,
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

      {/* 可见性与权限配置 */}
      <div className="space-y-3">
        <label className="text-sm font-medium">可见性与权限控制</label>
        <div className="border-border/80 bg-card rounded-xl border p-4 space-y-4 shadow-sm transition-all duration-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">限制使用权限</p>
              <p className="text-muted-foreground text-xs">
                默认公开，开启后仅指定的用户、角色或团队可使用此 Agent
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEnablePermissionLimit(!enablePermissionLimit)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                enablePermissionLimit ? "bg-primary" : "bg-neutral-200"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${
                  enablePermissionLimit ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {enablePermissionLimit && (
            <div className="space-y-4 border-t border-border/40 pt-4 animate-fadeIn transition-all duration-300">
              {/* 1. 按角色限制 */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  系统角色限制
                </p>
                <div className="flex gap-3">
                  {[
                    { id: "admin", name: "管理员 (admin)" },
                    { id: "user", name: "普通用户 (user)" },
                  ].map((role) => {
                    const isSelected = selectedRoles.includes(role.id)
                    return (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedRoles(selectedRoles.filter((r) => r !== role.id))
                          } else {
                            setSelectedRoles([...selectedRoles, role.id])
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150 cursor-pointer ${
                          isSelected
                            ? "bg-primary/10 border-primary text-primary"
                            : "bg-background border-border hover:bg-neutral-50"
                        }`}
                      >
                        {role.name}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 2. 按团队限制 */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  团队授权限制
                </p>
                {systemTeams.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {systemTeams.map((team) => {
                      const isSelected = selectedTeams.includes(team.id)
                      return (
                        <button
                          key={team.id}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setSelectedTeams(selectedTeams.filter((t) => t !== team.id))
                            } else {
                              setSelectedTeams([...selectedTeams, team.id])
                            }
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150 cursor-pointer ${
                            isSelected
                              ? "bg-primary/10 border-primary text-primary"
                              : "bg-background border-border hover:bg-neutral-50"
                          }`}
                        >
                          👥 {team.name}
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">暂无团队数据</p>
                )}
              </div>

              {/* 3. 按具体用户限制 */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  用户授权限制
                </p>
                {systemUsers.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {systemUsers.map((user) => {
                      const isSelected = selectedUsers.includes(user.id)
                      return (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setSelectedUsers(selectedUsers.filter((u) => u !== user.id))
                            } else {
                              setSelectedUsers([...selectedUsers, user.id])
                            }
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150 cursor-pointer ${
                            isSelected
                              ? "bg-primary/10 border-primary text-primary"
                              : "bg-background border-border hover:bg-neutral-50"
                          }`}
                        >
                          👤 {user.displayName} ({user.username})
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">暂无用户数据</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 数据源绑定 */}
      {datasources.length > 0 && (
        <div className="space-y-3">
          <label className="text-sm font-medium">数据源绑定</label>
          <div className="border-input rounded-md border p-3 space-y-3">
            {datasources.map((ds) => {
              const endpoints = parseEndpoints(ds.endpoints)
              const checked = isDatasourceChecked(ds.id)
              const dsSearch = deferredSearchMap[ds.id] ?? ""
              const filtered = filterEndpoints(endpoints, dsSearch)
              const filteredSet = new Set(filtered.map((f) => f.id))
              const checkedEpIds = getBinding(ds.id)?.endpointIds ?? []
              const checkedButHidden = dsSearch
                ? endpoints.filter((ep) => checkedEpIds.includes(ep.id) && !filteredSet.has(ep.id))
                : []
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
                      <div className="flex items-center justify-between">
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
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                          <input
                            type="text"
                            value={endpointSearchMap[ds.id] ?? ""}
                            onChange={(e) =>
                              setEndpointSearchMap((m) => ({ ...m, [ds.id]: e.target.value }))
                            }
                            placeholder="搜索接口..."
                            className="pl-8 pr-3 py-1.5 text-xs border border-border rounded-md bg-background w-48 focus:outline-none focus:ring-1 focus:ring-ring"
                          />
                        </div>
                      </div>
                      {!isAllEndpoints(ds.id) && (
                        <>
                          {filtered.map((ep) => {
                            const isWriteEp = ep.method && ep.method.toUpperCase() !== "GET"
                            const isChecked = isEndpointChecked(ds.id, ep.id)
                            return (
                              <div
                                key={ep.id}
                                className="flex items-center justify-between gap-2 py-0.5"
                              >
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    id={`ep-${ds.id}-${ep.id}`}
                                    checked={isChecked}
                                    onChange={() => toggleEndpoint(ds.id, ep.id)}
                                    className="h-3.5 w-3.5 rounded border border-border"
                                  />
                                  <label htmlFor={`ep-${ds.id}-${ep.id}`} className="text-xs">
                                    {ep.name || ep.path || ep.id}
                                    {ep.method && (
                                      <span className="text-[10px] text-muted-foreground ml-1.5 uppercase bg-secondary px-1 py-0.5 rounded">
                                        {ep.method}
                                      </span>
                                    )}
                                  </label>
                                </div>
                                {isWriteEp && isChecked && (
                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground select-none">
                                    <input
                                      type="checkbox"
                                      id={`ep-conf-${ds.id}-${ep.id}`}
                                      checked={isEndpointConfirmationChecked(ds.id, ep.id)}
                                      onChange={() => toggleEndpointConfirmation(ds.id, ep.id)}
                                      className="h-3.5 w-3.5 rounded border border-border"
                                    />
                                    <label
                                      htmlFor={`ep-conf-${ds.id}-${ep.id}`}
                                      className="text-[11px] text-destructive font-medium"
                                    >
                                      需要确认
                                    </label>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                          {checkedButHidden.map((ep) => {
                            const isWriteEp = ep.method && ep.method.toUpperCase() !== "GET"
                            return (
                              <div
                                key={ep.id}
                                className="flex items-center justify-between gap-2 py-0.5 opacity-65"
                              >
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    id={`ep-${ds.id}-${ep.id}`}
                                    checked
                                    onChange={() => toggleEndpoint(ds.id, ep.id)}
                                    className="h-3.5 w-3.5 rounded border border-border"
                                  />
                                  <label htmlFor={`ep-${ds.id}-${ep.id}`} className="text-xs">
                                    {ep.name || ep.path || ep.id}
                                    {ep.method && (
                                      <span className="text-[10px] text-muted-foreground ml-1.5 uppercase bg-secondary px-1 py-0.5 rounded">
                                        {ep.method}
                                      </span>
                                    )}
                                  </label>
                                </div>
                                {isWriteEp && (
                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground select-none">
                                    <input
                                      type="checkbox"
                                      id={`ep-conf-${ds.id}-${ep.id}`}
                                      checked={isEndpointConfirmationChecked(ds.id, ep.id)}
                                      onChange={() => toggleEndpointConfirmation(ds.id, ep.id)}
                                      className="h-3.5 w-3.5 rounded border border-border"
                                    />
                                    <label
                                      htmlFor={`ep-conf-${ds.id}-${ep.id}`}
                                      className="text-[11px] text-destructive font-medium"
                                    >
                                      需要确认
                                    </label>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                          {filtered.length === 0 && checkedButHidden.length === 0 && dsSearch && (
                            <p className="text-xs text-muted-foreground py-1">无匹配接口</p>
                          )}
                        </>
                      )}
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
