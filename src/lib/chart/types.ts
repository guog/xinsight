// 图表数据协议类型定义

export type ChartType = "line" | "bar" | "pie" | "area"

export interface ChartDataPoint {
  name: string
  [key: string]: string | number
}

export interface ChartConfig {
  type: ChartType
  title?: string
  xAxis?: string
  yAxis?: string
  data: ChartDataPoint[]
  series?: string[] // 多系列时指定 key 列表
}
