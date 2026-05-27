export interface WorkflowNode {
  id: string
  type: "agent" | "tool"
  config: {
    agentId?: string
    prompt?: string
    datasourceId?: string
    endpointId?: string
    params?: Record<string, any>
  }
}

export interface WorkflowEdge {
  source: string
  target: string
}

/**
 * 拓扑排序算法，根据 nodes 和 edges 计算出节点的先后顺序并检测循环依赖
 * 供工作流引擎（后端）和工作流画布编辑器（前端）共同使用
 */
export function topologicalSort(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
  const inDegree: Record<string, number> = {}
  const adj: Record<string, string[]> = {}
  const nodeMap: Record<string, WorkflowNode> = {}

  for (const n of nodes) {
    inDegree[n.id] = 0
    adj[n.id] = []
    nodeMap[n.id] = n
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

  const order: WorkflowNode[] = []
  while (queue.length > 0) {
    const u = queue.shift()!
    if (nodeMap[u]) {
      order.push(nodeMap[u])
    }
    for (const v of adj[u]) {
      inDegree[v]--
      if (inDegree[v] === 0) queue.push(v)
    }
  }

  if (order.length !== nodes.length) {
    throw new Error("工作流拓扑结构中存在循环依赖")
  }

  return order
}
