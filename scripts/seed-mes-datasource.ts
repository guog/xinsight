/**
 * Seed MES Mock API 数据源 + 端点级 Agent 绑定
 *
 * 用法：bun run scripts/seed-mes-datasource.ts
 *
 * 注册 1 个 MES 数据源（24 端点），并为 5 个域子 Agent + wikiAgent 配置端点级绑定。
 * base 域（6 端点）为所有子 Agent 共享。
 */
import { db } from "../src/db"
import { datasources, agentDatasources } from "../src/db/schema"
import { eq } from "drizzle-orm"
import type { RestEndpoint } from "../src/mastra/tools/datasource/types"

const MES_DATASOURCE_ID = "mes-mock"
const MES_BASE_URL = process.env.MES_BASE_URL || "http://localhost:3002"

// ========== 端点定义 ==========

const baseEndpoints: RestEndpoint[] = [
  {
    id: "base-lines",
    name: "获取产线列表",
    description: "获取所有生产线信息，包含名称、状态、节拍等",
    method: "GET",
    path: "/api/base/lines",
    params: { method: "GET", path: "/api/base/lines" },
    apiSchemaFormat: "natural",
    paramSchema: "无需参数",
  },
  {
    id: "base-stations",
    name: "获取工位列表",
    description: "获取工位信息，可按产线筛选",
    method: "GET",
    path: "/api/base/stations",
    queryParams: { lineId: "string" },
    params: { method: "GET", path: "/api/base/stations" },
    apiSchemaFormat: "natural",
    paramSchema: "可选参数: query.lineId — 按产线ID筛选工位",
  },
  {
    id: "base-shifts",
    name: "获取班次列表",
    description: "获取所有班次信息（早班/中班/夜班）",
    method: "GET",
    path: "/api/base/shifts",
    params: { method: "GET", path: "/api/base/shifts" },
    apiSchemaFormat: "natural",
    paramSchema: "无需参数",
  },
  {
    id: "base-teams",
    name: "获取班组列表",
    description: "获取所有班组信息",
    method: "GET",
    path: "/api/base/teams",
    params: { method: "GET", path: "/api/base/teams" },
    apiSchemaFormat: "natural",
    paramSchema: "无需参数",
  },
  {
    id: "base-materials",
    name: "获取物料列表",
    description: "获取物料/原材料信息，可按类别筛选",
    method: "GET",
    path: "/api/base/materials",
    queryParams: { category: "string" },
    params: { method: "GET", path: "/api/base/materials" },
    apiSchemaFormat: "natural",
    paramSchema: "可选参数: query.category — 按物料类别筛选（如 raw/semi/finished/packaging）",
  },
  {
    id: "base-personnel",
    name: "获取人员列表",
    description: "获取人员信息，可按班组筛选",
    method: "GET",
    path: "/api/base/personnel",
    queryParams: { teamId: "string" },
    params: { method: "GET", path: "/api/base/personnel" },
    apiSchemaFormat: "natural",
    paramSchema: "可选参数: query.teamId — 按班组ID筛选人员",
  },
]

const productionEndpoints: RestEndpoint[] = [
  {
    id: "production-orders",
    name: "获取生产工单列表",
    description: "获取生产工单，包含产品、数量、状态、进度等，可按产线和状态筛选",
    method: "GET",
    path: "/api/production/orders",
    queryParams: { lineId: "string", status: "string" },
    params: { method: "GET", path: "/api/production/orders" },
    apiSchemaFormat: "natural",
    paramSchema:
      "可选参数: query.lineId — 按产线筛选; query.status — 按状态筛选（pending/in_progress/completed/cancelled）",
  },
  {
    id: "production-order-detail",
    name: "获取工单详情",
    description: "获取指定工单的详细信息",
    method: "GET",
    path: "/api/production/orders/{id}",
    params: { method: "GET", path: "/api/production/orders/{id}" },
    apiSchemaFormat: "natural",
    paramSchema: "必填参数: path.id — 工单ID",
  },
  {
    id: "production-schedules",
    name: "获取排程列表",
    description: "获取生产排程/计划，包含日期、班次、产线分配",
    method: "GET",
    path: "/api/production/schedules",
    queryParams: { lineId: "string" },
    params: { method: "GET", path: "/api/production/schedules" },
    apiSchemaFormat: "natural",
    paramSchema: "可选参数: query.lineId — 按产线筛选排程",
  },
  {
    id: "production-process-routes",
    name: "获取工艺路线列表",
    description: "获取产品工艺路线（工序流程）",
    method: "GET",
    path: "/api/production/process-routes",
    params: { method: "GET", path: "/api/production/process-routes" },
    apiSchemaFormat: "natural",
    paramSchema: "无需参数",
  },
]

const qualityEndpoints: RestEndpoint[] = [
  {
    id: "quality-inspections",
    name: "获取检验记录",
    description: "获取质量检验记录，包含检验结果、不合格项等",
    method: "GET",
    path: "/api/quality/inspections",
    queryParams: { orderId: "string", result: "string" },
    params: { method: "GET", path: "/api/quality/inspections" },
    apiSchemaFormat: "natural",
    paramSchema:
      "可选参数: query.orderId — 按工单筛选; query.result — 按结果筛选（pass/fail/conditional）",
  },
  {
    id: "quality-defects",
    name: "获取缺陷记录",
    description: "获取产品缺陷记录，包含缺陷类型、严重程度、处理状态",
    method: "GET",
    path: "/api/quality/defects",
    queryParams: { orderId: "string" },
    params: { method: "GET", path: "/api/quality/defects" },
    apiSchemaFormat: "natural",
    paramSchema: "可选参数: query.orderId — 按工单筛选缺陷",
  },
  {
    id: "quality-spc",
    name: "获取SPC数据",
    description: "获取统计过程控制（SPC）数据，用于质量趋势分析",
    method: "GET",
    path: "/api/quality/spc",
    params: { method: "GET", path: "/api/quality/spc" },
    apiSchemaFormat: "natural",
    paramSchema: "无需参数",
  },
]

const equipmentEndpoints: RestEndpoint[] = [
  {
    id: "equipment-list",
    name: "获取设备列表",
    description: "获取设备信息，包含状态、所属产线等，可按产线和状态筛选",
    method: "GET",
    path: "/api/equipment",
    queryParams: { lineId: "string", status: "string" },
    params: { method: "GET", path: "/api/equipment" },
    apiSchemaFormat: "natural",
    paramSchema:
      "可选参数: query.lineId — 按产线筛选; query.status — 按状态筛选（running/idle/maintenance/fault）",
  },
  {
    id: "equipment-detail",
    name: "获取设备详情",
    description: "获取指定设备的详细信息",
    method: "GET",
    path: "/api/equipment/{id}",
    params: { method: "GET", path: "/api/equipment/{id}" },
    apiSchemaFormat: "natural",
    paramSchema: "必填参数: path.id — 设备ID",
  },
  {
    id: "equipment-maintenance",
    name: "获取维保记录",
    description: "获取设备维护保养记录",
    method: "GET",
    path: "/api/equipment/maintenance",
    params: { method: "GET", path: "/api/equipment/maintenance" },
    apiSchemaFormat: "natural",
    paramSchema: "无需参数",
  },
  {
    id: "equipment-alarms",
    name: "获取设备报警记录",
    description: "获取设备报警/故障记录",
    method: "GET",
    path: "/api/equipment/alarms",
    params: { method: "GET", path: "/api/equipment/alarms" },
    apiSchemaFormat: "natural",
    paramSchema: "无需参数",
  },
  {
    id: "equipment-spare-parts",
    name: "获取备件列表",
    description: "获取设备备件/备品信息",
    method: "GET",
    path: "/api/equipment/spare-parts",
    params: { method: "GET", path: "/api/equipment/spare-parts" },
    apiSchemaFormat: "natural",
    paramSchema: "无需参数",
  },
]

const warehouseEndpoints: RestEndpoint[] = [
  {
    id: "warehouse-inventory",
    name: "获取库存记录",
    description: "获取仓库库存信息，可按物料筛选",
    method: "GET",
    path: "/api/warehouse/inventory",
    queryParams: { materialId: "string" },
    params: { method: "GET", path: "/api/warehouse/inventory" },
    apiSchemaFormat: "natural",
    paramSchema: "可选参数: query.materialId — 按物料ID筛选库存",
  },
  {
    id: "warehouse-in-out",
    name: "获取出入库记录",
    description: "获取物料出入库流水记录",
    method: "GET",
    path: "/api/warehouse/in-out",
    queryParams: { type: "string" },
    params: { method: "GET", path: "/api/warehouse/in-out" },
    apiSchemaFormat: "natural",
    paramSchema: "可选参数: query.type — 按类型筛选（in/out）",
  },
  {
    id: "warehouse-locations",
    name: "获取库位列表",
    description: "获取仓库库位信息",
    method: "GET",
    path: "/api/warehouse/locations",
    params: { method: "GET", path: "/api/warehouse/locations" },
    apiSchemaFormat: "natural",
    paramSchema: "无需参数",
  },
]

const energyEndpoints: RestEndpoint[] = [
  {
    id: "energy-consumption",
    name: "获取能耗数据",
    description: "获取能源消耗数据（电、水、气等），可按产线和能源类型筛选",
    method: "GET",
    path: "/api/energy/consumption",
    queryParams: { lineId: "string", energyType: "string" },
    params: { method: "GET", path: "/api/energy/consumption" },
    apiSchemaFormat: "natural",
    paramSchema:
      "可选参数: query.lineId — 按产线筛选; query.energyType — 按能源类型筛选（electricity/water/gas/steam）",
  },
  {
    id: "energy-alarms",
    name: "获取能源报警",
    description: "获取能源异常报警记录",
    method: "GET",
    path: "/api/energy/alarms",
    params: { method: "GET", path: "/api/energy/alarms" },
    apiSchemaFormat: "natural",
    paramSchema: "无需参数",
  },
]

const traceabilityEndpoints: RestEndpoint[] = [
  {
    id: "traceability-list",
    name: "获取追溯记录",
    description: "获取产品追溯记录，可按工单和批次号筛选",
    method: "GET",
    path: "/api/traceability",
    queryParams: { orderId: "string", batchNo: "string" },
    params: { method: "GET", path: "/api/traceability" },
    apiSchemaFormat: "natural",
    paramSchema: "可选参数: query.orderId — 按工单筛选; query.batchNo — 按批次号筛选",
  },
  {
    id: "traceability-detail",
    name: "获取追溯详情",
    description: "获取指定追溯记录的详细信息（含原材料、工序、检验全链路）",
    method: "GET",
    path: "/api/traceability/{id}",
    params: { method: "GET", path: "/api/traceability/{id}" },
    apiSchemaFormat: "natural",
    paramSchema: "必填参数: path.id — 追溯记录ID",
  },
]

// ========== 所有端点 ==========
const allEndpoints: RestEndpoint[] = [
  ...baseEndpoints,
  ...productionEndpoints,
  ...qualityEndpoints,
  ...equipmentEndpoints,
  ...warehouseEndpoints,
  ...energyEndpoints,
  ...traceabilityEndpoints,
]

// ========== Agent → 端点绑定映射 ==========
const baseEndpointIds = baseEndpoints.map((e) => e.id)

/** 每个子 Agent 可访问的端点 ID 列表（base 共享给所有） */
const agentBindings: Record<string, string[]> = {
  // 生产管理专员：base + production + traceability
  "production-agent": [
    ...baseEndpointIds,
    ...productionEndpoints.map((e) => e.id),
    ...traceabilityEndpoints.map((e) => e.id),
  ],
  // 质量管理专员：base + quality + traceability
  "quality-agent": [
    ...baseEndpointIds,
    ...qualityEndpoints.map((e) => e.id),
    ...traceabilityEndpoints.map((e) => e.id),
  ],
  // 设备管理专员：base + equipment
  "equipment-agent": [...baseEndpointIds, ...equipmentEndpoints.map((e) => e.id)],
  // 仓储物流专员：base + warehouse
  "warehouse-agent": [...baseEndpointIds, ...warehouseEndpoints.map((e) => e.id)],
  // 能源管理专员：base + energy
  "energy-agent": [...baseEndpointIds, ...energyEndpoints.map((e) => e.id)],
}

// ========== 执行 Seed ==========

async function seed() {
  console.log("🏭 开始注册 MES Mock 数据源...")

  // 1. 清理旧数据
  await db.delete(agentDatasources).where(eq(agentDatasources.datasourceId, MES_DATASOURCE_ID))
  await db.delete(datasources).where(eq(datasources.id, MES_DATASOURCE_ID))
  console.log("  ✓ 清理旧数据")

  // 2. 创建数据源
  const now = new Date()
  await db.insert(datasources).values({
    id: MES_DATASOURCE_ID,
    name: "MES 制造执行系统",
    description:
      "西安基地智能制造 MES 系统，包含生产管理、质量管理、设备管理、仓储物流、能源管理、追溯管理等模块",
    type: "rest",
    auth: JSON.stringify({}),
    config: JSON.stringify({ baseUrl: MES_BASE_URL }),
    endpoints: JSON.stringify(allEndpoints),
    enabled: true,
    createdAt: now,
    updatedAt: now,
  })
  console.log(`  ✓ 创建数据源: ${MES_DATASOURCE_ID}（${allEndpoints.length} 个端点）`)

  // 3. 创建 Agent 绑定（端点级）
  for (const [agentId, endpointIds] of Object.entries(agentBindings)) {
    await db.insert(agentDatasources).values({
      agentId,
      datasourceId: MES_DATASOURCE_ID,
      endpointIds: JSON.stringify(endpointIds),
      createdAt: now,
    })
    console.log(`  ✓ 绑定 ${agentId} → ${endpointIds.length} 个端点`)
  }

  console.log("\n✅ MES 数据源注册完成！")
  console.log(`   数据源: ${MES_DATASOURCE_ID}`)
  console.log(`   端点数: ${allEndpoints.length}`)
  console.log(`   Agent 绑定: ${Object.keys(agentBindings).length} 个`)
}

seed().catch((err) => {
  console.error("❌ Seed 失败:", err)
  process.exit(1)
})
