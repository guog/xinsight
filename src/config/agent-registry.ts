import { Factory, FlaskConical, Wrench, Package, Zap, BookOpen } from "lucide-react"

/**
 * Agent 信息映射：工具名 → 子 Agent 元数据
 * 用于在 UI 上呈现多 Agent 会议对话感
 */
export const AGENT_MAP: Record<
  string,
  {
    name: string
    role: string
    icon: typeof Factory
    avatar: string
    color: string
    bgColor: string
    avatarBg: string
  }
> = {
  // Supervisor 委派子 Agent 的 tool 名格式: agent-xxxAgent
  "agent-productionAgent": {
    name: "李工",
    role: "生产管理专员",
    icon: Factory,
    avatar: "李",
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "from-blue-50/80 to-blue-50/30 dark:from-blue-950/30 dark:to-blue-950/10",
    avatarBg: "bg-blue-100 dark:bg-blue-900/50",
  },
  "agent-qualityAgent": {
    name: "张工",
    role: "质量管理专员",
    icon: FlaskConical,
    avatar: "张",
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "from-emerald-50/80 to-emerald-50/30 dark:from-emerald-950/30 dark:to-emerald-950/10",
    avatarBg: "bg-emerald-100 dark:bg-emerald-900/50",
  },
  "agent-equipmentAgent": {
    name: "王工",
    role: "设备管理专员",
    icon: Wrench,
    avatar: "王",
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "from-orange-50/80 to-orange-50/30 dark:from-orange-950/30 dark:to-orange-950/10",
    avatarBg: "bg-orange-100 dark:bg-orange-900/50",
  },
  "agent-warehouseAgent": {
    name: "赵工",
    role: "仓储物流专员",
    icon: Package,
    avatar: "赵",
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "from-purple-50/80 to-purple-50/30 dark:from-purple-950/30 dark:to-purple-950/10",
    avatarBg: "bg-purple-100 dark:bg-purple-900/50",
  },
  "agent-energyAgent": {
    name: "陈工",
    role: "能源管理专员",
    icon: Zap,
    avatar: "陈",
    color: "text-yellow-600 dark:text-yellow-400",
    bgColor: "from-yellow-50/80 to-yellow-50/30 dark:from-yellow-950/30 dark:to-yellow-950/10",
    avatarBg: "bg-yellow-100 dark:bg-yellow-900/50",
  },
  "agent-wikiAgent": {
    name: "孙工",
    role: "知识库专员",
    icon: BookOpen,
    avatar: "孙",
    color: "text-pink-600 dark:text-pink-400",
    bgColor: "from-pink-50/80 to-pink-50/30 dark:from-pink-950/30 dark:to-pink-950/10",
    avatarBg: "bg-pink-100 dark:bg-pink-900/50",
  },
}

/**
 * 工具名 → Agent 名映射（通过前缀匹配）
 */
export const TOOL_AGENT_MAP: Record<string, { agentName: string; toolLabel: string }> = {
  queryProductionOrders: { agentName: "李工", toolLabel: "生产工单查询" },
  queryProductionSchedule: { agentName: "李工", toolLabel: "生产排程查询" },
  queryProcessRoute: { agentName: "李工", toolLabel: "工艺路线查询" },
  getProductionSummary: { agentName: "李工", toolLabel: "生产总览" },
  queryProductionLines: { agentName: "李工", toolLabel: "产线查询" },
  queryShiftsTeams: { agentName: "李工", toolLabel: "班组查询" },
  queryInspections: { agentName: "张工", toolLabel: "质检记录查询" },
  queryDefects: { agentName: "张工", toolLabel: "缺陷查询" },
  getQualitySummary: { agentName: "张工", toolLabel: "质量总览" },
  querySpcData: { agentName: "张工", toolLabel: "SPC 数据查询" },
  queryEquipment: { agentName: "王工", toolLabel: "设备查询" },
  queryMaintenance: { agentName: "王工", toolLabel: "维护记录查询" },
  queryAlarms: { agentName: "王工", toolLabel: "告警查询" },
  getEquipmentSummary: { agentName: "王工", toolLabel: "设备总览" },
  queryInventory: { agentName: "赵工", toolLabel: "库存查询" },
  queryInOutRecords: { agentName: "赵工", toolLabel: "出入库记录" },
  getInventoryAlerts: { agentName: "赵工", toolLabel: "库存预警" },
  queryEnergyConsumption: { agentName: "陈工", toolLabel: "能耗查询" },
  getEnergySummary: { agentName: "陈工", toolLabel: "能源总览" },
  queryEnergyAlarms: { agentName: "陈工", toolLabel: "能源告警" },
  traceProduct: { agentName: "李工", toolLabel: "产品追溯" },
  traceMaterial: { agentName: "李工", toolLabel: "物料追溯" },
  queryMaterials: { agentName: "李工", toolLabel: "物料查询" },
  wikiSearchTool: { agentName: "孙工", toolLabel: "知识库搜索" },
  wikiReadTool: { agentName: "孙工", toolLabel: "知识库阅读" },
  wikiListTool: { agentName: "孙工", toolLabel: "知识库列表" },
}
