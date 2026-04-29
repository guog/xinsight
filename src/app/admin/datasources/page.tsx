"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { Plus, Zap, Pencil, Trash2, Loader2, Copy, Search } from "lucide-react"
import { toast } from "sonner"
import { useDatasources } from "@/hooks/use-datasources"

const typeBadge: Record<string, { label: string; color: string }> = {
  rest: {
    label: "REST API",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  },
  graphql: {
    label: "GraphQL",
    color: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  },
  grpc: {
    label: "gRPC",
    color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  },
  opcua: {
    label: "OPC UA",
    color: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  },
  mqtt: { label: "MQTT", color: "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300" },
}

const typeFilters = [
  { value: "all", label: "全部" },
  { value: "rest", label: "REST" },
  { value: "graphql", label: "GraphQL" },
  { value: "grpc", label: "gRPC" },
  { value: "opcua", label: "OPC UA" },
  { value: "mqtt", label: "MQTT" },
]

/** 计算相对时间 */
function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return "从未测试"
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return "刚刚"
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  return `${days}天前`
}

export default function DatasourcesPage() {
  const { datasources, loading, error, refresh, remove, testConnection, duplicate, batchUpdate } =
    useDatasources()
  const [testStatus, setTestStatus] = useState<Record<string, "testing" | "ok" | "failed">>({})
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // 筛选数据源
  const filtered = useMemo(() => {
    let list = datasources
    if (typeFilter !== "all") {
      list = list.filter((ds) => ds.type === typeFilter)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (ds) =>
          ds.name.toLowerCase().includes(q) ||
          (ds.description?.toLowerCase().includes(q) ?? false),
      )
    }
    return list
  }, [datasources, typeFilter, search])

  const handleTest = async (id: string) => {
    setTestStatus((s) => ({ ...s, [id]: "testing" }))
    try {
      const result = await testConnection(id)
      setTestStatus((s) => ({ ...s, [id]: result.ok ? "ok" : "failed" }))
      if (result.ok) {
        toast.success("连接测试成功")
      } else {
        toast.error("连接测试失败")
      }
    } catch {
      setTestStatus((s) => ({ ...s, [id]: "failed" }))
      toast.error("连接测试失败")
    }
  }

  const handleDelete = async (id: string) => {
    if (deleteConfirm !== id) {
      setDeleteConfirm(id)
      toast("再次点击确认删除", { duration: 3000 })
      setTimeout(() => setDeleteConfirm(null), 3000)
      return
    }
    setDeleteConfirm(null)
    try {
      await remove(id)
      setSelected((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      toast.success("数据源已删除")
    } catch {
      toast.error("删除失败，请重试")
    }
  }

  const handleDuplicate = async (id: string) => {
    try {
      await duplicate(id)
      toast.success("数据源已复制")
    } catch {
      toast.error("复制失败，请重试")
    }
  }

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map((ds) => ds.id)))
    }
  }

  const handleBatch = async (action: "enable" | "disable") => {
    try {
      await batchUpdate(action, Array.from(selected))
      setSelected(new Set())
      toast.success(action === "enable" ? "已批量启用" : "已批量禁用")
    } catch {
      toast.error("批量操作失败")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-sm text-red-500 mb-4">{error}</p>
        <button
          onClick={refresh}
          className="px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors text-sm"
        >
          重试
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">数据源列表</h2>
        <Link
          href="/admin/datasources/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm transition-colors hover:bg-primary/90"
        >
          <Plus className="size-4" />
          新建数据源
        </Link>
      </div>

      {/* 搜索栏 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="搜索数据源名称或描述..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {/* 类型筛选标签 */}
      <div className="flex items-center gap-1 flex-wrap">
        {typeFilters.map((f) => (
          <button
            key={f.value}
            onClick={() => setTypeFilter(f.value)}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
              typeFilter === f.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* 批量操作栏 */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-muted text-sm">
          <span className="text-muted-foreground">已选 {selected.size} 项</span>
          <button
            onClick={() => handleBatch("enable")}
            className="px-3 py-1 rounded bg-green-100 text-green-700 hover:bg-green-200 transition-colors text-xs"
          >
            批量启用
          </button>
          <button
            onClick={() => handleBatch("disable")}
            className="px-3 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200 transition-colors text-xs"
          >
            批量禁用
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="px-3 py-1 rounded border border-border hover:bg-background transition-colors text-xs"
          >
            取消选择
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-20 text-sm text-muted-foreground">
          {datasources.length === 0 ? "暂无数据源，点击上方按钮创建" : "没有匹配的数据源"}
        </div>
      ) : (
        <div className="border border-border rounded-lg divide-y divide-border">
          {/* 全选 */}
          <div className="flex items-center px-4 py-2 bg-muted/50">
            <input
              type="checkbox"
              checked={selected.size === filtered.length && filtered.length > 0}
              onChange={toggleSelectAll}
              className="mr-3 size-4 rounded border-border"
            />
            <span className="text-xs text-muted-foreground">全选</span>
          </div>
          {filtered.map((ds) => {
            const badge = typeBadge[ds.type] ?? {
              label: ds.type,
              color: "bg-muted text-muted-foreground",
            }
            const status = testStatus[ds.id]
            // 健康状态指示
            const healthColor =
              ds.lastTestResult === "ok"
                ? "bg-green-500"
                : ds.lastTestResult === "failed"
                  ? "bg-red-500"
                  : "bg-gray-400"
            return (
              <div key={ds.id} className="flex items-center justify-between px-4 py-3 gap-4">
                <input
                  type="checkbox"
                  checked={selected.has(ds.id)}
                  onChange={() => toggleSelect(ds.id)}
                  className="mr-2 size-4 rounded border-border shrink-0"
                />
                {/* 健康状态点 */}
                <span
                  className={`size-2.5 rounded-full shrink-0 ${healthColor}`}
                  title={
                    ds.lastTestResult === "ok"
                      ? `正常 · ${timeAgo(ds.lastTestedAt)}`
                      : ds.lastTestResult === "failed"
                        ? `异常 · ${timeAgo(ds.lastTestedAt)}`
                        : "从未测试"
                  }
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Link
                      href={`/admin/datasources/${ds.id}`}
                      className="font-medium text-sm truncate hover:text-primary transition-colors"
                    >
                      {ds.name}
                    </Link>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${badge.color}`}>
                      {badge.label}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-xs rounded-full ${ds.enabled ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" : "bg-muted text-muted-foreground"}`}
                    >
                      {ds.enabled ? "启用" : "禁用"}
                    </span>
                    {(ds.callCount ?? 0) > 0 && (
                      <span className="text-xs text-muted-foreground">
                        调用 {ds.callCount} 次
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {ds.description || ds.id}
                    {ds.lastTestedAt && (
                      <span className="ml-2">· 上次测试 {timeAgo(ds.lastTestedAt)}</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {status && (
                    <span
                      className={`text-xs mr-2 ${status === "testing" ? "text-muted-foreground" : status === "ok" ? "text-green-600" : "text-red-500"}`}
                    >
                      {status === "testing"
                        ? "测试中..."
                        : status === "ok"
                          ? "连接成功"
                          : "连接失败"}
                    </span>
                  )}
                  <button
                    onClick={() => handleTest(ds.id)}
                    title="测试连接"
                    className="p-2 rounded-lg hover:bg-muted transition-colors"
                  >
                    <Zap className="size-4" />
                  </button>
                  <button
                    onClick={() => handleDuplicate(ds.id)}
                    title="复制数据源"
                    className="p-2 rounded-lg hover:bg-muted transition-colors"
                  >
                    <Copy className="size-4" />
                  </button>
                  <Link
                    href={`/admin/datasources/${ds.id}/edit`}
                    className="p-2 rounded-lg hover:bg-muted transition-colors"
                  >
                    <Pencil className="size-4" />
                  </Link>
                  <button
                    onClick={() => handleDelete(ds.id)}
                    title="删除"
                    className="p-2 rounded-lg hover:bg-muted text-red-500 transition-colors"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
