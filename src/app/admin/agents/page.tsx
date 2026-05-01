"use client"

import { useState, useEffect } from "react"
import { Bot, Database, Loader2 } from "lucide-react"

interface Agent {
  id: string
  name: string
}

interface Datasource {
  id: string
  name: string
  type: string
  enabled: boolean
}

interface AgentDetail extends Agent {
  datasources: Datasource[]
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    async function load() {
      try {
        // 加载 agents
        const agentsRes = await fetch("/api/agents")
        if (!agentsRes.ok) throw new Error("加载 Agent 列表失败")
        const agentList: Agent[] = await agentsRes.json()

        // 加载数据源列表
        const dsRes = await fetch("/api/datasources")
        const dsList: Datasource[] = dsRes.ok ? await dsRes.json() : []

        // 加载每个 agent 绑定的数据源
        const details: AgentDetail[] = await Promise.all(
          agentList.map(async (agent) => {
            try {
              // 尝试从数据源反查绑定关系
              const bindingsRes = await fetch(`/api/agents/${agent.id}/datasources`)
              const bindings: { datasourceId: string }[] = bindingsRes.ok
                ? await bindingsRes.json()
                : []
              const boundDs = bindings
                .map((b) => dsList.find((d) => d.id === b.datasourceId))
                .filter(Boolean) as Datasource[]
              return { ...agent, datasources: boundDs }
            } catch {
              return { ...agent, datasources: [] }
            }
          }),
        )

        setAgents(details)
      } catch (e) {
        setError(e instanceof Error ? e.message : "加载失败")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

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
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }

  return (
    <div className="animate-in fade-in duration-300 space-y-4">
      <h2 className="text-lg font-medium">Agent 列表</h2>
      <p className="text-sm text-muted-foreground">
        以下是 Mastra 中注册的所有 Agent，及其绑定的数据源。
      </p>

      {agents.length === 0 ? (
        <div className="text-center py-20 text-sm text-muted-foreground">暂无 Agent</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="bg-card border border-border rounded-xl p-4 space-y-3 transition-shadow duration-200 hover:shadow-md"
            >
              <div className="flex items-center gap-2">
                <Bot className="size-5 text-primary" />
                <div>
                  <div className="font-medium text-sm">{agent.name}</div>
                  <div className="text-xs text-muted-foreground">{agent.id}</div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Database className="size-3" /> 绑定数据源
                </div>
                {agent.datasources.length === 0 ? (
                  <p className="text-xs text-muted-foreground">未绑定数据源</p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {agent.datasources.map((ds) => (
                      <span
                        key={ds.id}
                        className={`px-2 py-0.5 text-xs rounded-full ${
                          ds.enabled
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {ds.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
