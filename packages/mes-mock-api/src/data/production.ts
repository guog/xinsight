// 生产数据 - 生产工单、排程、工艺路线

export interface ProductionOrder {
  id: string
  productId: string
  productName: string
  lineId: string
  quantity: number
  completedQty: number
  status: "已完成" | "进行中" | "已计划"
  plannedStart: Date
  plannedEnd: Date
  actualStart?: Date
  actualEnd?: Date
  priority: "高" | "中" | "低"
}

export interface Schedule {
  id: string
  orderId: string
  shiftId: string
  teamId: string
  date: Date
  lineId: string
}

export interface ProcessRoute {
  id: string
  productId: string
  productName: string
  steps: ProcessStep[]
}

export interface ProcessStep {
  sequence: number
  name: string
  stationId: string
  standardTime: number // 秒
  description: string
}

const today = new Date()
const monday = new Date(today)
monday.setDate(today.getDate() - today.getDay() + 1)
monday.setHours(0, 0, 0, 0)

function dayOf(offset: number): Date {
  const d = new Date(monday)
  d.setDate(monday.getDate() + offset)
  return d
}

export const productionOrders: ProductionOrder[] = [
  // 已完成 (5)
  {
    id: "PO-001",
    productId: "MAT-F01",
    productName: "前保险杠支架",
    lineId: "LINE-A",
    quantity: 200,
    completedQty: 200,
    status: "已完成",
    plannedStart: dayOf(0),
    plannedEnd: dayOf(0),
    actualStart: dayOf(0),
    actualEnd: dayOf(0),
    priority: "高",
  },
  {
    id: "PO-002",
    productId: "MAT-F02",
    productName: "后防撞梁",
    lineId: "LINE-B",
    quantity: 150,
    completedQty: 150,
    status: "已完成",
    plannedStart: dayOf(0),
    plannedEnd: dayOf(1),
    actualStart: dayOf(0),
    actualEnd: dayOf(1),
    priority: "高",
  },
  {
    id: "PO-003",
    productId: "MAT-F03",
    productName: "车门铰链",
    lineId: "LINE-A",
    quantity: 300,
    completedQty: 300,
    status: "已完成",
    plannedStart: dayOf(1),
    plannedEnd: dayOf(1),
    actualStart: dayOf(1),
    actualEnd: dayOf(1),
    priority: "中",
  },
  {
    id: "PO-004",
    productId: "MAT-F04",
    productName: "发动机支架",
    lineId: "LINE-B",
    quantity: 100,
    completedQty: 100,
    status: "已完成",
    plannedStart: dayOf(1),
    plannedEnd: dayOf(2),
    actualStart: dayOf(1),
    actualEnd: dayOf(2),
    priority: "中",
  },
  {
    id: "PO-005",
    productId: "MAT-F05",
    productName: "排气管法兰",
    lineId: "LINE-A",
    quantity: 250,
    completedQty: 250,
    status: "已完成",
    plannedStart: dayOf(2),
    plannedEnd: dayOf(2),
    actualStart: dayOf(2),
    actualEnd: dayOf(2),
    priority: "低",
  },
  // 进行中 (5)
  {
    id: "PO-006",
    productId: "MAT-F01",
    productName: "前保险杠支架",
    lineId: "LINE-A",
    quantity: 200,
    completedQty: 120,
    status: "进行中",
    plannedStart: dayOf(3),
    plannedEnd: dayOf(4),
    actualStart: dayOf(3),
    priority: "高",
  },
  {
    id: "PO-007",
    productId: "MAT-F02",
    productName: "后防撞梁",
    lineId: "LINE-B",
    quantity: 180,
    completedQty: 90,
    status: "进行中",
    plannedStart: dayOf(3),
    plannedEnd: dayOf(4),
    actualStart: dayOf(3),
    priority: "高",
  },
  {
    id: "PO-008",
    productId: "MAT-F03",
    productName: "车门铰链",
    lineId: "LINE-A",
    quantity: 350,
    completedQty: 200,
    status: "进行中",
    plannedStart: dayOf(3),
    plannedEnd: dayOf(5),
    actualStart: dayOf(3),
    priority: "中",
  },
  {
    id: "PO-009",
    productId: "MAT-F04",
    productName: "发动机支架",
    lineId: "LINE-B",
    quantity: 120,
    completedQty: 45,
    status: "进行中",
    plannedStart: dayOf(4),
    plannedEnd: dayOf(5),
    actualStart: dayOf(4),
    priority: "中",
  },
  {
    id: "PO-010",
    productId: "MAT-F05",
    productName: "排气管法兰",
    lineId: "LINE-B",
    quantity: 200,
    completedQty: 60,
    status: "进行中",
    plannedStart: dayOf(4),
    plannedEnd: dayOf(5),
    actualStart: dayOf(4),
    priority: "低",
  },
  // 已计划 (5)
  {
    id: "PO-011",
    productId: "MAT-F01",
    productName: "前保险杠支架",
    lineId: "LINE-A",
    quantity: 250,
    completedQty: 0,
    status: "已计划",
    plannedStart: dayOf(5),
    plannedEnd: dayOf(6),
    priority: "高",
  },
  {
    id: "PO-012",
    productId: "MAT-F02",
    productName: "后防撞梁",
    lineId: "LINE-B",
    quantity: 200,
    completedQty: 0,
    status: "已计划",
    plannedStart: dayOf(5),
    plannedEnd: dayOf(6),
    priority: "中",
  },
  {
    id: "PO-013",
    productId: "MAT-F03",
    productName: "车门铰链",
    lineId: "LINE-A",
    quantity: 400,
    completedQty: 0,
    status: "已计划",
    plannedStart: dayOf(5),
    plannedEnd: dayOf(6),
    priority: "中",
  },
  {
    id: "PO-014",
    productId: "MAT-F04",
    productName: "发动机支架",
    lineId: "LINE-B",
    quantity: 150,
    completedQty: 0,
    status: "已计划",
    plannedStart: dayOf(6),
    plannedEnd: dayOf(6),
    priority: "低",
  },
  {
    id: "PO-015",
    productId: "MAT-F05",
    productName: "排气管法兰",
    lineId: "LINE-A",
    quantity: 300,
    completedQty: 0,
    status: "已计划",
    plannedStart: dayOf(6),
    plannedEnd: dayOf(6),
    priority: "低",
  },
]

export const schedules: Schedule[] = productionOrders.map((order, i) => ({
  id: `SCH-${String(i + 1).padStart(3, "0")}`,
  orderId: order.id,
  shiftId: `SHIFT-${(i % 3) + 1}`,
  teamId: `TEAM-${(i % 4) + 1}`,
  date: order.plannedStart,
  lineId: order.lineId,
}))

export const processRoutes: ProcessRoute[] = [
  {
    id: "ROUTE-01",
    productId: "MAT-F01",
    productName: "前保险杠支架",
    steps: [
      {
        sequence: 1,
        name: "下料",
        stationId: "ST-A01",
        standardTime: 30,
        description: "钢板剪切下料",
      },
      {
        sequence: 2,
        name: "冲压成型",
        stationId: "ST-A02",
        standardTime: 45,
        description: "模具冲压成型",
      },
      {
        sequence: 3,
        name: "修边冲孔",
        stationId: "ST-A03",
        standardTime: 35,
        description: "去除毛边并冲孔",
      },
      {
        sequence: 4,
        name: "焊接加强筋",
        stationId: "ST-B01",
        standardTime: 60,
        description: "点焊加强筋",
      },
      {
        sequence: 5,
        name: "终检",
        stationId: "ST-B03",
        standardTime: 40,
        description: "尺寸及外观检测",
      },
    ],
  },
  {
    id: "ROUTE-02",
    productId: "MAT-F02",
    productName: "后防撞梁",
    steps: [
      {
        sequence: 1,
        name: "管材切割",
        stationId: "ST-A01",
        standardTime: 25,
        description: "不锈钢管切割",
      },
      {
        sequence: 2,
        name: "弯管成型",
        stationId: "ST-A02",
        standardTime: 50,
        description: "数控弯管",
      },
      {
        sequence: 3,
        name: "端部冲压",
        stationId: "ST-A03",
        standardTime: 40,
        description: "端部压扁成型",
      },
      {
        sequence: 4,
        name: "焊接连接板",
        stationId: "ST-B01",
        standardTime: 55,
        description: "焊接安装连接板",
      },
      {
        sequence: 5,
        name: "弧焊加固",
        stationId: "ST-B02",
        standardTime: 65,
        description: "关键部位弧焊",
      },
      {
        sequence: 6,
        name: "终检",
        stationId: "ST-B03",
        standardTime: 45,
        description: "焊缝及尺寸检测",
      },
    ],
  },
  {
    id: "ROUTE-03",
    productId: "MAT-F03",
    productName: "车门铰链",
    steps: [
      {
        sequence: 1,
        name: "冲压",
        stationId: "ST-A01",
        standardTime: 20,
        description: "铰链片冲压",
      },
      {
        sequence: 2,
        name: "冲孔攻丝",
        stationId: "ST-A02",
        standardTime: 30,
        description: "安装孔加工",
      },
      { sequence: 3, name: "组装", stationId: "ST-B01", standardTime: 40, description: "销轴组装" },
      {
        sequence: 4,
        name: "终检",
        stationId: "ST-B03",
        standardTime: 25,
        description: "转动测试及检测",
      },
    ],
  },
  {
    id: "ROUTE-04",
    productId: "MAT-F04",
    productName: "发动机支架",
    steps: [
      { sequence: 1, name: "下料", stationId: "ST-A01", standardTime: 35, description: "厚板下料" },
      {
        sequence: 2,
        name: "冲压成型",
        stationId: "ST-A02",
        standardTime: 55,
        description: "多道冲压",
      },
      {
        sequence: 3,
        name: "焊接组装",
        stationId: "ST-B01",
        standardTime: 70,
        description: "多件焊接组装",
      },
      {
        sequence: 4,
        name: "弧焊加固",
        stationId: "ST-B02",
        standardTime: 60,
        description: "承力点弧焊",
      },
      {
        sequence: 5,
        name: "终检",
        stationId: "ST-B03",
        standardTime: 50,
        description: "探伤及尺寸检测",
      },
    ],
  },
  {
    id: "ROUTE-05",
    productId: "MAT-F05",
    productName: "排气管法兰",
    steps: [
      {
        sequence: 1,
        name: "冲压落料",
        stationId: "ST-A01",
        standardTime: 20,
        description: "法兰片落料",
      },
      {
        sequence: 2,
        name: "冲孔",
        stationId: "ST-A02",
        standardTime: 25,
        description: "螺栓孔冲孔",
      },
      {
        sequence: 3,
        name: "终检",
        stationId: "ST-B03",
        standardTime: 20,
        description: "平面度及孔位检测",
      },
    ],
  },
]
