"use client"

import React, { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Save, ArrowLeft, Trash2, Bot, Database, Settings2, HelpCircle } from "lucide-react"
import { toast } from "sonner"

interface Node {
  id: string
  type: "agent" | "tool"
  x: number
  y: number
  config: {
    agentId?: string
    prompt?: string
    datasourceId?: string
    endpointId?: string
    params?: Record<string, any>
  }
}

interface Edge {
  source: string
  target: string
}

interface WorkflowEditorProps {
  initialId?: string
  isEdit?: boolean
}

interface SystemAgent {
  id: string
  name: string
}

interface SystemDatasource {
  id: string
  name: string
  type: string
  endpoints: any
}

export default function WorkflowEditor({ initialId = "", isEdit = false }: WorkflowEditorProps) {
  const router = useRouter()

  // 基础信息
  const [wfId, setWfId] = useState(initialId)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [status, setStatus] = useState<"draft" | "published">("draft")

  // 画布节点与边
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])

  // 系统注册数据列表
  const [systemAgents, setSystemAgents] = useState<SystemAgent[]>([])
  const [systemDatasources, setSystemDatasources] = useState<SystemDatasource[]>([])

  // 状态维护
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // 拖动节点逻辑
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null)
  const dragStartOffset = useRef({ x: 0, y: 0 })

  // 画布连线中逻辑
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const canvasRef = useRef<HTMLDivElement>(null)

  // 加载数据
  useEffect(() => {
    const loadSystemData = async () => {
      try {
        const [agentsRes, dsRes] = await Promise.all([
          fetch("/api/agents"),
          fetch("/api/datasources"),
        ])

        if (agentsRes.ok) {
          const agentsData = await agentsRes.json()
          setSystemAgents(agentsData)
        }
        if (dsRes.ok) {
          const dsData = await dsRes.json()
          setSystemDatasources(
            dsData.map((d: any) => ({
              ...d,
              endpoints: typeof d.endpoints === "string" ? JSON.parse(d.endpoints) : d.endpoints,
            })),
          )
        }
      } catch (error) {
        console.error("加载注册资产异常:", error)
        toast.error("加载注册资产异常")
      }
    }

    const loadWorkflow = async () => {
      if (!isEdit || !initialId) {
        setLoading(false)
        return
      }

      try {
        const res = await fetch(`/api/admin/workflows/${initialId}`)
        if (res.ok) {
          const data = await res.json()
          const wf = data.workflow
          setName(wf.name)
          setDescription(wf.description || "")
          setStatus(wf.status)

          const definition = JSON.parse(wf.definition)
          setNodes(definition.nodes || [])
          setEdges(definition.edges || [])
        } else {
          toast.error("加载工作流失败")
        }
      } catch (error) {
        console.error("加载工作流异常:", error)
        toast.error("加载工作流异常")
      } finally {
        setLoading(false)
      }
    }

    Promise.all([loadSystemData(), loadWorkflow()]).then(() => {
      setLoading(false)
    })
  }, [isEdit, initialId])

  // 添加节点
  const addNode = (type: "agent" | "tool") => {
    const id = `${type}_${Date.now().toString().slice(-6)}`
    const newNode: Node = {
      id,
      type,
      x: 100 + Math.random() * 80,
      y: 100 + Math.random() * 80,
      config: type === "agent" ? { prompt: "" } : { params: {} },
    }
    setNodes((prev) => [...prev, newNode])
    setSelectedNodeId(id)
    toast.success(`已添加${type === "agent" ? "Agent" : "Tool"}节点`)
  }

  // 删除节点
  const deleteNode = (id: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id))
    setEdges((prev) => prev.filter((e) => e.source !== id && e.target !== id))
    if (selectedNodeId === id) setSelectedNodeId(null)
  }

  // 拓扑排序校验循环依赖
  const checkWorkflowValidity = (): boolean => {
    const inDegree: Record<string, number> = {}
    const adj: Record<string, string[]> = {}

    for (const n of nodes) {
      inDegree[n.id] = 0
      adj[n.id] = []
    }

    for (const e of edges) {
      if (adj[e.source] && inDegree[e.target] !== undefined) {
        adj[e.source].push(e.target)
        inDegree[e.target]++
      }
    }

    const queue: string[] = []
    for (const id of Object.keys(inDegree)) {
      if (inDegree[id] === 0) queue.push(id)
    }

    const order: string[] = []
    while (queue.length > 0) {
      const u = queue.shift()!
      order.push(u)
      for (const v of adj[u]) {
        inDegree[v]--
        if (inDegree[v] === 0) queue.push(v)
      }
    }

    if (order.length !== nodes.length) {
      toast.error("工作流拓扑结构中存在循环依赖，请检查连线！")
      return false
    }

    // 检查字段
    for (const n of nodes) {
      if (n.type === "agent" && !n.config.agentId) {
        toast.error(`节点 [${n.id}] 未选择有效的 Agent`)
        return false
      }
      if (n.type === "tool" && (!n.config.datasourceId || !n.config.endpointId)) {
        toast.error(`节点 [${n.id}] 未选择有效的数据源与端点`)
        return false
      }
    }

    return true
  }

  // 保存工作流
  const handleSave = async () => {
    if (!wfId.trim() || !name.trim()) {
      toast.error("请输入工作流ID与工作流名称")
      return
    }

    if (nodes.length === 0) {
      toast.error("工作流节点不能为空")
      return
    }

    if (!checkWorkflowValidity()) return

    const definition = JSON.stringify({ nodes, edges })

    try {
      const url = isEdit ? `/api/admin/workflows/${wfId}` : "/api/admin/workflows"
      const method = isEdit ? "PUT" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: wfId,
          name,
          description,
          status,
          definition,
        }),
      })

      if (res.ok) {
        toast.success("工作流保存成功")
        router.push("/admin/workflows")
        router.refresh()
      } else {
        const data = await res.json()
        toast.error(`保存失败: ${data.error || "未知错误"}`)
      }
    } catch (error) {
      console.error("保存工作流异常:", error)
      toast.error("保存工作流异常")
    }
  }

  // 处理拖动节点 mouse down
  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    if (
      (e.target as HTMLElement).closest(".dot-connector") ||
      (e.target as HTMLElement).closest(".btn-delete")
    ) {
      return
    }
    setSelectedNodeId(nodeId)
    setDraggingNodeId(nodeId)
    const node = nodes.find((n) => n.id === nodeId)
    if (node) {
      dragStartOffset.current = {
        x: e.clientX - node.x,
        y: e.clientY - node.y,
      }
    }
    e.preventDefault()
  }

  // 鼠标移动 (处理画布拖拽 & 连线)
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!canvasRef.current) return

    const rect = canvasRef.current.getBoundingClientRect()

    if (draggingNodeId) {
      const x = e.clientX - dragStartOffset.current.x
      const y = e.clientY - dragStartOffset.current.y
      setNodes((prev) =>
        prev.map((n) =>
          n.id === draggingNodeId ? { ...n, x: Math.max(0, x), y: Math.max(0, y) } : n,
        ),
      )
    }

    if (connectingSourceId) {
      setMousePos({
        x: e.clientX - rect.left + canvasRef.current.scrollLeft,
        y: e.clientY - rect.top + canvasRef.current.scrollTop,
      })
    }
  }

  // 鼠标抬起 (释放拖动或连线)
  const handleMouseUp = () => {
    setDraggingNodeId(null)
    setConnectingSourceId(null)
  }

  // 开始从某个 Out 点连线
  const handleConnectorStart = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation()
    if (!canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    setConnectingSourceId(nodeId)
    setMousePos({
      x: e.clientX - rect.left + canvasRef.current.scrollLeft,
      y: e.clientY - rect.top + canvasRef.current.scrollTop,
    })
  }

  // 释放到某个 In 点，建立连接
  const handleConnectorEnd = (e: React.MouseEvent, targetNodeId: string) => {
    e.stopPropagation()
    if (connectingSourceId && connectingSourceId !== targetNodeId) {
      // 避免重复边
      const exists = edges.some(
        (edge) => edge.source === connectingSourceId && edge.target === targetNodeId,
      )
      if (!exists) {
        setEdges((prev) => [...prev, { source: connectingSourceId, target: targetNodeId }])
        toast.success("连接已建立")
      }
    }
    setConnectingSourceId(null)
  }

  // 双击或点击删除连线
  const deleteEdge = (source: string, target: string) => {
    setEdges((prev) => prev.filter((e) => !(e.source === source && e.target === target)))
    toast.success("连线已断开")
  }

  // 计算贝塞尔曲线
  const getBezierPath = (x1: number, y1: number, x2: number, y2: number) => {
    const cp1x = x1 + Math.abs(x2 - x1) * 0.4
    const cp2x = x2 - Math.abs(x2 - x1) * 0.4
    return `M ${x1} ${y1} C ${cp1x} ${y1}, ${cp2x} ${y2}, ${x2} ${y2}`
  }

  const selectedNode = nodes.find((n) => n.id === selectedNodeId)

  // 更新选中节点配置
  const updateNodeConfig = (updates: Partial<Node["config"]>) => {
    if (!selectedNodeId) return
    setNodes((prev) =>
      prev.map((n) =>
        n.id === selectedNodeId ? { ...n, config: { ...n.config, ...updates } } : n,
      ),
    )
  }

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground text-sm">加载中...</div>
  }

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] border border-border rounded-2xl overflow-hidden bg-background">
      {/* 顶部状态与工具栏 */}
      <header className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-border bg-card/60 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/admin/workflows")}
            className="p-2 border border-border hover:bg-muted active:scale-95 transition-all rounded-lg"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="工作流中文名称"
                className="font-bold text-base bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none px-1 transition-all"
              />
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-md font-mono">
                {isEdit ? wfId : "新建"}
              </span>
            </div>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="添加工作流描述信息..."
              className="text-xs text-muted-foreground bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none px-1 w-64 transition-all"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!isEdit && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground font-mono">工作流ID:</label>
              <input
                type="text"
                value={wfId}
                onChange={(e) => setWfId(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))}
                placeholder="英文标识, 如 mes-sync"
                className="text-xs font-mono px-3 py-1.5 border border-border rounded-lg focus:outline-none focus:border-primary"
              />
            </div>
          )}

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            className="text-xs px-3 py-1.5 border border-border rounded-lg bg-background focus:outline-none focus:border-primary"
          >
            <option value="draft">草稿</option>
            <option value="published">发布运行</option>
          </select>

          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-primary hover:bg-primary/95 active:scale-95 transition-all rounded-lg shadow-lg shadow-primary/20"
          >
            <Save className="size-3.5" />
            保存
          </button>
        </div>
      </header>

      {/* 主体画布与属性区域 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左侧节点工具面板 */}
        <aside className="w-48 border-r border-border bg-card/20 p-4 space-y-4">
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              组件库
            </h4>
            <p className="text-[11px] text-muted-foreground mb-4">
              点击组件将步骤节点添加到中央画布。
            </p>
            <div className="space-y-2">
              <button
                onClick={() => addNode("agent")}
                className="flex items-center gap-2 w-full p-3 text-left text-xs font-medium border border-border hover:border-primary/50 hover:bg-primary/5 active:scale-95 transition-all rounded-xl shadow-sm"
              >
                <Bot className="size-4 text-primary" />
                <div>
                  <div className="font-semibold text-foreground">Agent 节点</div>
                  <div className="text-[10px] text-muted-foreground">执行大模型推理决策</div>
                </div>
              </button>

              <button
                onClick={() => addNode("tool")}
                className="flex items-center gap-2 w-full p-3 text-left text-xs font-medium border border-border hover:border-violet-500/50 hover:bg-violet-500/5 active:scale-95 transition-all rounded-xl shadow-sm"
              >
                <Database className="size-4 text-violet-500" />
                <div>
                  <div className="font-semibold text-foreground">Tool 数据源端点</div>
                  <div className="text-[10px] text-muted-foreground">调用内部与外部API</div>
                </div>
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-border">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
              <HelpCircle className="size-3.5" />
              连线说明
            </h4>
            <ul className="text-[10px] text-muted-foreground space-y-1 list-disc list-inside">
              <li>
                按住右侧 <span className="text-violet-500">Out</span> 圆点向右拉。
              </li>
              <li>
                拖动到下级节点的左侧 <span className="text-emerald-500">In</span> 并释放。
              </li>
              <li>双击或点击连线可删除依赖。</li>
            </ul>
          </div>
        </aside>

        {/* 画布中央区域 */}
        <div
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className="flex-1 relative overflow-auto bg-slate-50 dark:bg-zinc-950/40 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] select-none"
        >
          {/* SVG 连线图层 */}
          <svg className="absolute top-0 left-0 w-[2000px] h-[2000px] pointer-events-none z-0">
            {edges.map((edge, idx) => {
              const fromNode = nodes.find((n) => n.id === edge.source)
              const toNode = nodes.find((n) => n.id === edge.target)
              if (!fromNode || !toNode) return null

              const x1 = fromNode.x + 180
              const y1 = fromNode.y + 40
              const x2 = toNode.x
              const y2 = toNode.y + 40

              const path = getBezierPath(x1, y1, x2, y2)
              return (
                <g key={idx} className="pointer-events-auto group cursor-pointer">
                  {/* 用于点击的高亮虚线/辅助线 */}
                  <path
                    d={path}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="10"
                    onClick={() => deleteEdge(edge.source, edge.target)}
                    className="hover:stroke-destructive/20 transition-all"
                  />
                  <path
                    d={path}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    className="text-muted-foreground/60 group-hover:text-destructive group-hover:stroke-2 transition-all"
                  />
                </g>
              )
            })}

            {/* 连线过程中的临时 SVG */}
            {connectingSourceId &&
              (() => {
                const srcNode = nodes.find((n) => n.id === connectingSourceId)
                if (!srcNode) return null
                const x1 = srcNode.x + 180
                const y1 = srcNode.y + 40
                return (
                  <path
                    d={getBezierPath(x1, y1, mousePos.x, mousePos.y)}
                    fill="none"
                    stroke="var(--color-primary)"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                  />
                )
              })()}
          </svg>

          {/* 节点元素 */}
          <div className="absolute top-0 left-0 w-[2000px] h-[2000px] pointer-events-none">
            {nodes.map((node) => {
              const isSelected = node.id === selectedNodeId
              const agentName = systemAgents.find((a) => a.id === node.config.agentId)?.name || ""
              const dsName =
                systemDatasources.find((d) => d.id === node.config.datasourceId)?.name || ""

              return (
                <div
                  key={node.id}
                  style={{ left: node.x, top: node.y }}
                  onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                  className={`absolute w-[180px] p-3 rounded-xl border bg-card/90 backdrop-blur shadow-sm select-none pointer-events-auto transition-shadow cursor-grab active:cursor-grabbing z-10 ${
                    isSelected
                      ? "border-primary shadow-md ring-2 ring-primary/10"
                      : "border-border hover:border-muted-foreground/30"
                  }`}
                >
                  {/* 连接点 - In (左侧) */}
                  <div
                    onMouseUp={(e) => handleConnectorEnd(e, node.id)}
                    className="dot-connector absolute left-0 top-[40px] -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-emerald-500 border border-background rounded-full cursor-crosshair hover:scale-125 transition-transform"
                    title="输入 In"
                  />

                  {/* 连接点 - Out (右侧) */}
                  <div
                    onMouseDown={(e) => handleConnectorStart(e, node.id)}
                    className="dot-connector absolute right-0 top-[40px] translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-violet-500 border border-background rounded-full cursor-crosshair hover:scale-125 transition-transform"
                    title="输出 Out"
                  />

                  {/* 头部 */}
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {node.type === "agent" ? (
                        <Bot className="size-3 text-primary" />
                      ) : (
                        <Database className="size-3 text-violet-500" />
                      )}
                      {node.type === "agent" ? "Agent" : "Tool"}
                    </span>
                    <button
                      onClick={() => deleteNode(node.id)}
                      className="btn-delete p-1 text-muted-foreground hover:text-destructive rounded-md hover:bg-muted transition-colors"
                      title="删除步骤"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>

                  {/* 标题 */}
                  <div className="text-xs font-bold truncate">{node.id}</div>

                  {/* 关联信息摘要 */}
                  <div className="text-[10px] text-muted-foreground mt-1 truncate">
                    {node.type === "agent"
                      ? agentName
                        ? `角色: ${agentName}`
                        : "未配置 Agent"
                      : dsName
                        ? `数据源: ${dsName}`
                        : "未配置数据源"}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 右侧属性配置侧边栏 */}
        <aside className="w-80 border-l border-border bg-card/60 backdrop-blur p-5 overflow-y-auto space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <Settings2 className="size-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">节点属性配置</h3>
          </div>

          {selectedNode ? (
            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-muted-foreground mb-1 font-semibold">节点 ID:</label>
                <input
                  type="text"
                  value={selectedNode.id}
                  disabled
                  className="w-full px-3 py-1.5 border border-border rounded-lg bg-muted text-muted-foreground font-mono cursor-not-allowed"
                />
              </div>

              {selectedNode.type === "agent" ? (
                <>
                  <div>
                    <label className="block text-muted-foreground mb-1 font-semibold">
                      选择 Agent:
                    </label>
                    <select
                      value={selectedNode.config.agentId || ""}
                      onChange={(e) => updateNodeConfig({ agentId: e.target.value })}
                      className="w-full px-3 py-1.5 border border-border rounded-lg bg-background focus:outline-none focus:border-primary"
                    >
                      <option value="">-- 请选择 Agent --</option>
                      {systemAgents.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.id})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-muted-foreground mb-1 font-semibold">
                      Prompt 提示词:
                    </label>
                    <textarea
                      rows={5}
                      value={selectedNode.config.prompt || ""}
                      onChange={(e) => updateNodeConfig({ prompt: e.target.value })}
                      placeholder="例: 请根据此设备状态给出分析建议: {{node_1.output.detail}}"
                      className="w-full px-3 py-1.5 border border-border rounded-lg bg-background focus:outline-none focus:border-primary font-mono leading-relaxed"
                    />
                    <div className="text-[10px] text-muted-foreground mt-1 space-y-1">
                      <p>支持使用变量：</p>
                      <ul className="list-disc list-inside">
                        <li>
                          全局输入：<code className="bg-muted px-1 rounded">{"{{input.xxx}}"}</code>
                        </li>
                        <li>
                          节点输出：
                          <code className="bg-muted px-1 rounded">{"{{nodeId.output.yyy}}"}</code>
                        </li>
                      </ul>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-muted-foreground mb-1 font-semibold">
                      选择数据源:
                    </label>
                    <select
                      value={selectedNode.config.datasourceId || ""}
                      onChange={(e) =>
                        updateNodeConfig({
                          datasourceId: e.target.value,
                          endpointId: "",
                          params: {},
                        })
                      }
                      className="w-full px-3 py-1.5 border border-border rounded-lg bg-background focus:outline-none focus:border-primary"
                    >
                      <option value="">-- 请选择数据源 --</option>
                      {systemDatasources.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.type})
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedNode.config.datasourceId &&
                    (() => {
                      const ds = systemDatasources.find(
                        (d) => d.id === selectedNode.config.datasourceId,
                      )
                      const eps = ds?.endpoints || []
                      return (
                        <div>
                          <label className="block text-muted-foreground mb-1 font-semibold">
                            选择端点 (Endpoint):
                          </label>
                          <select
                            value={selectedNode.config.endpointId || ""}
                            onChange={(e) =>
                              updateNodeConfig({ endpointId: e.target.value, params: {} })
                            }
                            className="w-full px-3 py-1.5 border border-border rounded-lg bg-background focus:outline-none focus:border-primary"
                          >
                            <option value="">-- 请选择 API 端点 --</option>
                            {eps.map((ep: any) => (
                              <option key={ep.id} value={ep.id}>
                                {ep.name || ep.id} ({ep.params?.method || "GET"} {ep.params?.path})
                              </option>
                            ))}
                          </select>
                        </div>
                      )
                    })()}

                  {selectedNode.config.endpointId &&
                    (() => {
                      const ds = systemDatasources.find(
                        (d) => d.id === selectedNode.config.datasourceId,
                      )
                      const ep = ds?.endpoints?.find(
                        (e: any) => e.id === selectedNode.config.endpointId,
                      )
                      if (!ep) return null

                      // 检查参数结构
                      const paramKeys = ep.paramSchema
                        ? (() => {
                            try {
                              const parsed =
                                typeof ep.paramSchema === "string"
                                  ? JSON.parse(ep.paramSchema)
                                  : ep.paramSchema
                              if (parsed && parsed.properties) {
                                return Object.keys(parsed.properties)
                              }
                            } catch {}
                            return []
                          })()
                        : []

                      return (
                        <div className="space-y-3">
                          <label className="block text-muted-foreground font-semibold">
                            请求参数映射:
                          </label>
                          {paramKeys.length === 0 ? (
                            <div className="space-y-1">
                              <p className="text-[10px] text-muted-foreground">
                                请输入参数映射 JSON
                              </p>
                              <textarea
                                rows={4}
                                value={JSON.stringify(selectedNode.config.params || {}, null, 2)}
                                onChange={(e) => {
                                  try {
                                    updateNodeConfig({ params: JSON.parse(e.target.value) })
                                  } catch {}
                                }}
                                className="w-full px-3 py-1.5 border border-border rounded-lg bg-background focus:outline-none focus:border-primary font-mono"
                              />
                            </div>
                          ) : (
                            <div className="space-y-2 border border-border p-3 rounded-lg bg-muted/20">
                              {paramKeys.map((key) => (
                                <div key={key}>
                                  <div className="text-[11px] font-semibold text-foreground mb-0.5">
                                    {key}:
                                  </div>
                                  <input
                                    type="text"
                                    value={selectedNode.config.params?.[key] || ""}
                                    placeholder={`{{nodeId.output.property}} 或固定值`}
                                    onChange={(e) => {
                                      const nextParams = { ...(selectedNode.config.params || {}) }
                                      nextParams[key] = e.target.value
                                      updateNodeConfig({ params: nextParams })
                                    }}
                                    className="w-full px-2.5 py-1 border border-border rounded-lg bg-background focus:outline-none focus:border-primary font-mono text-[11px]"
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="text-[10px] text-muted-foreground space-y-1">
                            <p>参数取值同样支持：</p>
                            <ul className="list-disc list-inside">
                              <li>
                                <code className="bg-muted px-1 rounded">
                                  {"{{nodeId.output.xxx}}"}
                                </code>
                              </li>
                            </ul>
                          </div>
                        </div>
                      )
                    })()}
                </>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground text-xs">
              在中央画布上点击节点即可配置其运行属性。
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
