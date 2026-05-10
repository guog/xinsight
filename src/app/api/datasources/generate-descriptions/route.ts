import { NextResponse } from "next/server"
import { requireAdmin, handleAuthError } from "@/lib/auth"

interface EndpointInput {
  id: string
  name?: string
  description?: string
  method?: string
  path?: string
  operationType?: string
  operationName?: string
  structuredParams?: Array<{ name: string; type: string; description?: string }>
}

/** 中文动词映射 */
const METHOD_VERBS: Record<string, string> = {
  GET: "查询",
  POST: "创建",
  PUT: "更新",
  PATCH: "修改",
  DELETE: "删除",
}

/** 常见路径段中文映射 */
const PATH_TERMS: Record<string, string> = {
  production: "生产",
  order: "工单",
  orders: "工单",
  product: "产品",
  products: "产品",
  material: "物料",
  materials: "物料",
  inventory: "库存",
  equipment: "设备",
  quality: "质量",
  inspection: "质检",
  defect: "缺陷",
  defects: "缺陷",
  energy: "能源",
  alarm: "告警",
  alarms: "告警",
  maintenance: "维保",
  warehouse: "仓库",
  daily: "每日",
  monthly: "每月",
  weekly: "每周",
  summary: "汇总",
  detail: "详情",
  details: "详情",
  list: "列表",
  stats: "统计",
  statistics: "统计",
  report: "报表",
  reports: "报表",
  status: "状态",
  history: "历史",
  trend: "趋势",
  line: "产线",
  lines: "产线",
  worker: "人员",
  workers: "人员",
  shift: "班次",
  shifts: "班次",
  process: "工艺",
  routing: "工艺路线",
  bom: "BOM",
  spare: "备件",
  spares: "备件",
  spc: "SPC",
  oee: "OEE",
  yield: "良品率",
  output: "产出",
  downtime: "停机",
  consumption: "消耗",
  cost: "成本",
  batch: "批次",
  trace: "追溯",
  traceability: "追溯",
  user: "用户",
  users: "用户",
  config: "配置",
  setting: "设置",
  settings: "设置",
}

function generateDescription(ep: EndpointInput): string {
  // 已有描述就保留
  if (ep.description && ep.description.trim()) return ep.description

  const method = ep.method?.toUpperCase() ?? "GET"
  const verb = METHOD_VERBS[method] ?? "操作"
  const path = ep.path ?? ""

  // 解析 path segments
  const segments = path
    .split("/")
    .filter(
      (s) =>
        s && !s.startsWith("{") && !s.startsWith(":") && s !== "api" && s !== "v1" && s !== "v2",
    )

  // 翻译 segments
  const translated = segments.map((s) => PATH_TERMS[s.toLowerCase()] ?? s).filter(Boolean)

  if (translated.length === 0) {
    return `${verb}数据`
  }

  // 组合：查询 + 每日 + 生产 + 数据
  const subject = translated.join("")
  return `${verb}${subject}数据`
}

/** POST /api/datasources/generate-descriptions — 批量生成端点中文描述 */
export async function POST(request: Request) {
  try {
    await requireAdmin()
    const { endpoints } = (await request.json()) as { endpoints: EndpointInput[] }

    if (!Array.isArray(endpoints)) {
      return NextResponse.json({ error: "endpoints 必须是数组" }, { status: 400 })
    }

    const result = endpoints.map((ep) => ({
      ...ep,
      description: generateDescription(ep),
    }))

    return NextResponse.json({ endpoints: result })
  } catch (error) {
    const authResp = handleAuthError(error)
    if (authResp) return authResp
    return NextResponse.json({ error: "生成描述失败" }, { status: 500 })
  }
}
