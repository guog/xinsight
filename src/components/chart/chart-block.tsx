"use client"

import { useMemo } from "react"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts"
import { Download, Check } from "lucide-react"
import { useState, useCallback, useRef } from "react"
import { toPng } from "html-to-image"
import { ChartConfig } from "@/lib/chart/parse-chart-block"

const COLORS = [
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#f97316", // orange
  "#ec4899", // pink
]

interface ChartBlockProps {
  config: ChartConfig
}

export function ChartBlock({ config }: ChartBlockProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [exportSuccess, setExportSuccess] = useState(false)

  const handleExport = useCallback(async () => {
    if (!chartRef.current) return

    try {
      setIsExporting(true)
      const dataUrl = await toPng(chartRef.current, {
        cacheBust: true,
        backgroundColor: "hsl(var(--card))",
        style: { padding: "1rem" },
      })

      const link = document.createElement("a")
      link.download = `${config.title || "chart"}-${new Date().getTime()}.png`
      link.href = dataUrl
      link.click()

      setExportSuccess(true)
      setTimeout(() => setExportSuccess(false), 2000)
    } catch (err) {
      console.error("Failed to export chart:", err)
    } finally {
      setIsExporting(false)
    }
  }, [config.title])

  const { type, title, data, series, xKey = "name" } = config

  // Infer series keys from data if not specified
  const seriesKeys = useMemo(() => {
    if (series?.length) return series
    if (!data.length) return []
    return Object.keys(data[0]).filter((k) => k !== xKey && typeof data[0][k] === "number")
  }, [data, series, xKey])

  if (!data.length) return null

  return (
    <div
      className="group relative my-4 rounded-xl border border-border/50 bg-card p-4 shadow-sm"
      ref={chartRef}
    >
      <button
        onClick={handleExport}
        disabled={isExporting}
        className="absolute top-2 right-2 p-1.5 rounded-md bg-muted/50 opacity-0 group-hover:opacity-100 hover:bg-muted transition-all disabled:opacity-50 z-10 text-muted-foreground hover:text-foreground"
        title="导出为图片"
      >
        {exportSuccess ? (
          <Check className="size-4 text-green-500" />
        ) : (
          <Download className="size-4" />
        )}
      </button>
      {title && <h4 className="mb-3 text-sm font-semibold text-foreground">{title}</h4>}
      <ResponsiveContainer width="100%" height={280}>
        {type === "pie" ? (
          <PieChart>
            <Pie
              data={data}
              dataKey={seriesKeys[0] || "value"}
              nameKey={xKey}
              cx="50%"
              cy="50%"
              outerRadius={100}
              label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
            >
              {data.map((_, idx) => (
                <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        ) : type === "area" ? (
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            {seriesKeys.map((key, idx) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                stroke={COLORS[idx % COLORS.length]}
                fill={COLORS[idx % COLORS.length]}
                fillOpacity={0.2}
              />
            ))}
          </AreaChart>
        ) : type === "line" ? (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            {seriesKeys.map((key, idx) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={COLORS[idx % COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            ))}
          </LineChart>
        ) : (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            {seriesKeys.map((key, idx) => (
              <Bar
                key={key}
                dataKey={key}
                fill={COLORS[idx % COLORS.length]}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}
