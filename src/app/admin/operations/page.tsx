"use client"

import { useEffect, useRef, useState } from "react"
import * as echarts from "echarts"
import {
  BarChart3,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Smile,
  Calendar,
  Bot,
  ChevronDown,
  ChevronUp,
} from "lucide-react"

interface SummaryData {
  totalMessages: number
  totalFeedbacks: number
  totalUp: number
  totalDown: number
  satisfactionRate: number
}

interface TrendItem {
  date: string
  messages: number
  up: number
  down: number
}

interface AgentStat {
  agentId: string
  messages: number
  satisfactionRate: number
  up: number
  down: number
}

interface FeedbackDetail {
  id: string
  type: string // "up" | "down"
  comment: string | null
  createdAt: string
  chatId: string
  chatTitle: string
  agentId: string
  username: string
  displayName: string
  messageContent: string // JSON
}

interface AgentOption {
  id: string
  name: string
  icon: string | null
}

export default function OperationsPage() {
  const [summary, setSummary] = useState<SummaryData>({
    totalMessages: 0,
    totalFeedbacks: 0,
    totalUp: 0,
    totalDown: 0,
    satisfactionRate: 100,
  })
  const [trend, setTrend] = useState<TrendItem[]>([])
  const [agentStats, setAgentStats] = useState<AgentStat[]>([])
  const [feedbacks, setFeedbacks] = useState<FeedbackDetail[]>([])
  const [agents, setAgents] = useState<AgentOption[]>([])
  const [loading, setLoading] = useState(true)

  // 筛选状态
  const [timeRange, setTimeRange] = useState("7") // "7" | "30" | "90"
  const [selectedAgentId, setSelectedAgentId] = useState("")
  const [feedbackPage, setFeedbackPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // 展开反馈记录状态
  const [expandedFeedbackId, setExpandedFeedbackId] = useState<string | null>(null)

  // ECharts DOM 节点 refs
  const trendChartRef = useRef<HTMLDivElement | null>(null)
  const agentChartRef = useRef<HTMLDivElement | null>(null)

  // ECharts 实例 refs
  const trendChartInstance = useRef<echarts.ECharts | null>(null)
  const agentChartInstance = useRef<echarts.ECharts | null>(null)

  // 获取 Agent 下拉列表
  const fetchAgents = async () => {
    try {
      const res = await fetch("/api/admin/agents")
      const data = await res.json()
      setAgents(Array.isArray(data) ? data : data.agents || [])
    } catch (e) {
      console.error("获取 Agent 列表失败", e)
    }
  }

  // 获取汇总及图表数据
  const fetchStats = async () => {
    try {
      const end = new Date()
      const start = new Date(Date.now() - parseInt(timeRange) * 24 * 3600 * 1000)

      const query = new URLSearchParams({
        startDate: start.toISOString().split("T")[0],
        endDate: end.toISOString().split("T")[0],
      })
      if (selectedAgentId) {
        query.append("agentId", selectedAgentId)
      }

      const res = await fetch(`/api/admin/operations/stats?${query.toString()}`)
      const data = await res.json()
      if (res.ok) {
        setSummary(data.summary)
        setTrend(data.trend)
        setAgentStats(data.agentStats)
      }
    } catch (e) {
      console.error("获取统计数据失败", e)
    }
  }

  // 获取反馈表格明细
  const fetchFeedbacks = async () => {
    try {
      const query = new URLSearchParams({
        page: feedbackPage.toString(),
        limit: "10",
      })
      if (selectedAgentId) {
        query.append("agentId", selectedAgentId)
      }
      const res = await fetch(`/api/admin/operations/feedbacks?${query.toString()}`)
      const data = await res.json()
      if (res.ok) {
        setFeedbacks(data.feedbacks)
        setTotalPages(data.pagination.totalPages)
      }
    } catch (e) {
      console.error("获取反馈明细失败", e)
    }
  }

  // 综合初始化数据
  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    void fetchAgents()
  }, [])

  // 筛选条件变化时更新
  useEffect(() => {
    const updateAll = async () => {
      setLoading(true)
      await Promise.all([fetchStats(), fetchFeedbacks()])
      setLoading(false)
    }
    void updateAll()
  }, [timeRange, selectedAgentId, feedbackPage])
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  // ECharts 图表渲染与重绘逻辑
  useEffect(() => {
    if (loading || trend.length === 0) return

    // 1. 互动趋势折线图
    if (trendChartRef.current) {
      if (!trendChartInstance.current) {
        trendChartInstance.current = echarts.init(trendChartRef.current)
      }

      const option: echarts.EChartsOption = {
        tooltip: {
          trigger: "axis",
          axisPointer: { type: "cross" },
        },
        legend: {
          data: ["交互频次", "点赞数", "点踩数"],
          textStyle: { color: "#6b7280" },
        },
        grid: {
          left: "3%",
          right: "4%",
          bottom: "3%",
          containLabel: true,
        },
        xAxis: [
          {
            type: "category",
            boundaryGap: false,
            data: trend.map((t) => t.date.substring(5)), // 简写 MM-DD
            axisLabel: { color: "#9ca3af" },
            axisLine: { lineStyle: { color: "#e5e7eb" } },
          },
        ],
        yAxis: [
          {
            type: "value",
            name: "交互频次",
            axisLabel: { color: "#9ca3af" },
            splitLine: { lineStyle: { color: "#f3f4f6" } },
          },
        ],
        series: [
          {
            name: "交互频次",
            type: "line",
            smooth: true,
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: "rgba(59, 130, 246, 0.2)" },
                { offset: 1, color: "rgba(59, 130, 246, 0.0)" },
              ]),
            },
            lineStyle: { width: 3, color: "#3b82f6" },
            itemStyle: { color: "#3b82f6" },
            data: trend.map((t) => t.messages),
          },
          {
            name: "点赞数",
            type: "line",
            smooth: true,
            lineStyle: { width: 2, color: "#10b981" },
            itemStyle: { color: "#10b981" },
            data: trend.map((t) => t.up),
          },
          {
            name: "点踩数",
            type: "line",
            smooth: true,
            lineStyle: { width: 2, color: "#ef4444" },
            itemStyle: { color: "#ef4444" },
            data: trend.map((t) => t.down),
          },
        ],
      }
      trendChartInstance.current.setOption(option)
    }

    // 2. Agent 交互分布饼图
    if (agentChartRef.current && agentStats.length > 0) {
      if (!agentChartInstance.current) {
        agentChartInstance.current = echarts.init(agentChartRef.current)
      }

      const pieData = agentStats.map((stat) => {
        const agent = agents.find((a) => a.id === stat.agentId)
        return {
          value: stat.messages,
          name: agent?.name || stat.agentId,
        }
      })

      const option: echarts.EChartsOption = {
        tooltip: {
          trigger: "item",
          formatter: "{a} <br/>{b} : {c} ({d}%)",
        },
        legend: {
          orient: "vertical",
          left: "left",
          textStyle: { color: "#6b7280" },
        },
        series: [
          {
            name: "互动次数",
            type: "pie",
            radius: "55%",
            center: ["60%", "50%"],
            roseType: "radius",
            data: pieData,
            emphasis: {
              itemStyle: {
                shadowBlur: 10,
                shadowOffsetX: 0,
                shadowColor: "rgba(0, 0, 0, 0.5)",
              },
            },
          },
        ],
      }
      agentChartInstance.current.setOption(option)
    }

    // 监听 resize
    const handleResize = () => {
      trendChartInstance.current?.resize()
      agentChartInstance.current?.resize()
    }
    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
    }
  }, [loading, trend, agentStats, agents])

  // 销毁图表实例
  useEffect(() => {
    return () => {
      trendChartInstance.current?.dispose()
      agentChartInstance.current?.dispose()
      trendChartInstance.current = null
      agentChartInstance.current = null
    }
  }, [])

  // 解析消息 JSON parts 显示文本
  const renderMessageContent = (partsStr: string) => {
    try {
      const parts = JSON.parse(partsStr)
      if (Array.isArray(parts)) {
        return parts
          .filter((p) => p.type === "text")
          .map((p) => p.text)
          .join("\n")
      }
      return partsStr
    } catch {
      return partsStr
    }
  }

  const getAgentName = (id: string) => {
    const agent = agents.find((a) => a.id === id)
    return agent ? `${agent.icon || "🤖"} ${agent.name}` : id
  }

  return (
    <div className="animate-in fade-in duration-300 p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="size-6 text-primary" />
            运营数据统计
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            监控和分析各个业务 Agent 的运行状态、会话消息指标以及用户反馈好评率。
          </p>
        </div>

        {/* 顶部多维筛选 */}
        <div className="flex flex-wrap items-center gap-3 bg-muted/30 p-2 border border-border rounded-xl">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground px-2">
            <Calendar className="size-3.5" />
            <span>时间段</span>
          </div>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="text-xs bg-background border border-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
          >
            <option value="7">最近 7 天</option>
            <option value="30">最近 30 天</option>
            <option value="90">最近 90 天</option>
          </select>

          <div className="h-4 w-px bg-border my-auto mx-1" />

          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground px-2">
            <Bot className="size-3.5" />
            <span>Agent 过滤</span>
          </div>
          <select
            value={selectedAgentId}
            onChange={(e) => {
              setSelectedAgentId(e.target.value)
              setFeedbackPage(1)
            }}
            className="text-xs bg-background border border-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
          >
            <option value="">全部 Agent</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.icon || "🤖"} {agent.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 指标大屏数据卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              互动消息总频次
            </span>
            <div className="p-2 bg-blue-500/10 text-blue-500 rounded-xl">
              <MessageSquare className="size-4.5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-foreground">{summary.totalMessages}</h3>
            <p className="text-[10px] text-muted-foreground mt-1">此时间范围内生成的所有消息数</p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              反馈满意好评率
            </span>
            <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl">
              <Smile className="size-4.5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-foreground">{summary.satisfactionRate}%</h3>
            <p className="text-[10px] text-muted-foreground mt-1">
              好评数占比 (点赞 / (点赞+点踩))
            </p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              累计用户好评数
            </span>
            <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl">
              <ThumbsUp className="size-4.5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-foreground">{summary.totalUp}</h3>
            <p className="text-[10px] text-muted-foreground mt-1">获得的用户点赞频次</p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              累计用户点踩数
            </span>
            <div className="p-2 bg-red-500/10 text-red-500 rounded-xl">
              <ThumbsDown className="size-4.5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-foreground">{summary.totalDown}</h3>
            <p className="text-[10px] text-muted-foreground mt-1">获得的用户点踩频次</p>
          </div>
        </div>
      </div>

      {/* ECharts 图表区 */}
      {!loading && trend.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-5 shadow-xs flex flex-col">
            <h3 className="font-semibold text-sm text-foreground mb-4">交互趋势与反馈曲线</h3>
            <div ref={trendChartRef} className="w-full h-[320px] flex-1" />
          </div>

          <div className="bg-card border border-border rounded-2xl p-5 shadow-xs flex flex-col">
            <h3 className="font-semibold text-sm text-foreground mb-4">Agent 互动分布情况</h3>
            <div ref={agentChartRef} className="w-full h-[320px] flex-1" />
          </div>
        </div>
      )}

      {/* 反馈详情明细 */}
      <div className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden">
        <div className="p-5 border-b border-border">
          <h3 className="font-semibold text-sm text-foreground">用户反馈明细列表</h3>
          <p className="text-xs text-muted-foreground mt-1">
            查看用户对 Agent 消息所做的具体好评、差评以及填写的建议评论。
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/20 text-left text-muted-foreground">
                <th className="p-3 w-8" />
                <th className="p-3 font-medium">反馈时间</th>
                <th className="p-3 font-medium">反馈用户</th>
                <th className="p-3 font-medium">涉及 Agent</th>
                <th className="p-3 font-medium">反馈类型</th>
                <th className="p-3 font-medium">评论与反馈建议</th>
                <th className="p-3 font-medium">关联对话会话</th>
              </tr>
            </thead>
            <tbody>
              {feedbacks.map((fb) => {
                const isExpanded = expandedFeedbackId === fb.id
                return (
                  <>
                    <tr
                      key={fb.id}
                      className="border-b hover:bg-muted/10 transition-colors cursor-pointer"
                      onClick={() => setExpandedFeedbackId(isExpanded ? null : fb.id)}
                    >
                      <td className="p-3 text-center">
                        {isExpanded ? (
                          <ChevronUp className="size-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="size-4 text-muted-foreground" />
                        )}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {new Date(fb.createdAt).toLocaleString("zh-CN")}
                      </td>
                      <td className="p-3 font-medium text-foreground">
                        {fb.displayName} ({fb.username})
                      </td>
                      <td className="p-3 text-xs text-primary font-medium">
                        {getAgentName(fb.agentId)}
                      </td>
                      <td className="p-3">
                        {fb.type === "up" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                            <ThumbsUp className="size-3" />赞
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">
                            <ThumbsDown className="size-3" />踩
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-xs text-foreground max-w-[240px] truncate">
                        {fb.comment || (
                          <span className="text-muted-foreground italic">无评论内容</span>
                        )}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground font-mono">
                        {fb.chatTitle}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-muted/30">
                        <td colSpan={7} className="p-4 border-b">
                          <div className="space-y-3">
                            <div>
                              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                消息回复原文
                              </span>
                              <div className="mt-1 bg-background border border-border rounded-xl p-3.5 text-xs text-foreground font-sans whitespace-pre-wrap leading-relaxed shadow-inner">
                                {renderMessageContent(fb.messageContent)}
                              </div>
                            </div>
                            {fb.comment && (
                              <div>
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                  用户书面意见
                                </span>
                                <p className="mt-1 text-xs text-foreground font-medium pl-1">
                                  {fb.comment}
                                </p>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
              {feedbacks.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground italic">
                    此筛选条件下暂无任何用户反馈数据。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 分页控制 */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-border flex justify-between items-center bg-muted/10 text-xs">
            <span className="text-muted-foreground">
              当前第 {feedbackPage} 页，共 {totalPages} 页
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setFeedbackPage((p) => Math.max(1, p - 1))}
                disabled={feedbackPage === 1}
                className="px-3 py-1.5 bg-secondary text-secondary-foreground hover:bg-secondary/90 disabled:opacity-50 border rounded-lg transition-colors cursor-pointer"
              >
                上一页
              </button>
              <button
                onClick={() => setFeedbackPage((p) => Math.min(totalPages, p + 1))}
                disabled={feedbackPage === totalPages}
                className="px-3 py-1.5 bg-secondary text-secondary-foreground hover:bg-secondary/90 disabled:opacity-50 border rounded-lg transition-colors cursor-pointer"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
