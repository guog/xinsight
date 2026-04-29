"use client"

import dynamic from "next/dynamic"
import type { ChartConfig } from "@/lib/chart/types"

// 懒加载 Recharts 减少首屏 bundle
const LazyChartRenderer = dynamic(() => import("./chart-renderer"), {
  loading: () => (
    <div className="my-4 flex h-64 items-center justify-center rounded-lg border border-border bg-card">
      <span className="text-sm text-muted-foreground">加载图表中...</span>
    </div>
  ),
  ssr: false,
})

interface ChartBlockProps {
  config: ChartConfig
}

export function ChartBlock({ config }: ChartBlockProps) {
  return <LazyChartRenderer config={config} />
}
