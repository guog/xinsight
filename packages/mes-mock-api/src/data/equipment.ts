// 设备数据 - 设备清单、维保记录、报警记录、备件

export interface Equipment {
  id: string
  name: string
  lineId: string
  stationId: string
  model: string
  manufacturer: string
  installDate: string
  status: "运行中" | "停机维护" | "待机" | "故障"
}

export interface MaintenanceRecord {
  id: string
  equipmentId: string
  equipmentName: string
  type: "预防性维护" | "故障维修" | "定期保养"
  description: string
  startTime: Date
  endTime?: Date
  technicianId: string
  status: "已完成" | "进行中"
  cost: number
  spareParts: string[]
}

export interface AlarmRecord {
  id: string
  equipmentId: string
  equipmentName: string
  alarmType: string
  severity: "紧急" | "重要" | "一般"
  description: string
  timestamp: Date
  acknowledged: boolean
  resolvedAt?: Date
}

export interface SparePart {
  id: string
  name: string
  code: string
  applicableEquipment: string[]
  stock: number
  minStock: number
  unit: string
  unitPrice: number
}

const today = new Date()
const monday = new Date(today)
monday.setDate(today.getDate() - today.getDay() + 1)
monday.setHours(0, 0, 0, 0)

function dayOf(offset: number, hour = 8): Date {
  const d = new Date(monday)
  d.setDate(monday.getDate() + offset)
  d.setHours(hour, 0, 0, 0)
  return d
}

export const equipmentList: Equipment[] = [
  // LINE-A 冲压线 (6台)
  {
    id: "EQ-A01",
    name: "800T冲压机",
    lineId: "LINE-A",
    stationId: "ST-A01",
    model: "JH21-800",
    manufacturer: "济南二机",
    installDate: "2022-03-15",
    status: "运行中",
  },
  {
    id: "EQ-A02",
    name: "400T冲压机",
    lineId: "LINE-A",
    stationId: "ST-A01",
    model: "JH21-400",
    manufacturer: "济南二机",
    installDate: "2022-03-15",
    status: "运行中",
  },
  {
    id: "EQ-A03",
    name: "数控冲床",
    lineId: "LINE-A",
    stationId: "ST-A02",
    model: "VT-300",
    manufacturer: "通快",
    installDate: "2023-01-10",
    status: "运行中",
  },
  {
    id: "EQ-A04",
    name: "液压冲床",
    lineId: "LINE-A",
    stationId: "ST-A02",
    model: "YH-200",
    manufacturer: "扬力",
    installDate: "2022-06-20",
    status: "待机",
  },
  {
    id: "EQ-A05",
    name: "修边机",
    lineId: "LINE-A",
    stationId: "ST-A03",
    model: "TB-100",
    manufacturer: "舒勒",
    installDate: "2022-03-15",
    status: "运行中",
  },
  {
    id: "EQ-A06",
    name: "去毛刺机",
    lineId: "LINE-A",
    stationId: "ST-A03",
    model: "DB-50",
    manufacturer: "凯尔贝格",
    installDate: "2023-05-08",
    status: "运行中",
  },
  // LINE-B 焊接线 (6台)
  {
    id: "EQ-B01",
    name: "点焊机器人",
    lineId: "LINE-B",
    stationId: "ST-B01",
    model: "IRB-6700",
    manufacturer: "ABB",
    installDate: "2023-01-10",
    status: "运行中",
  },
  {
    id: "EQ-B02",
    name: "点焊机器人2",
    lineId: "LINE-B",
    stationId: "ST-B01",
    model: "IRB-6700",
    manufacturer: "ABB",
    installDate: "2023-01-10",
    status: "停机维护",
  },
  {
    id: "EQ-B03",
    name: "弧焊机器人",
    lineId: "LINE-B",
    stationId: "ST-B02",
    model: "ARC-Mate120iD",
    manufacturer: "发那科",
    installDate: "2022-09-01",
    status: "运行中",
  },
  {
    id: "EQ-B04",
    name: "弧焊机器人2",
    lineId: "LINE-B",
    stationId: "ST-B02",
    model: "ARC-Mate120iD",
    manufacturer: "发那科",
    installDate: "2022-09-01",
    status: "运行中",
  },
  {
    id: "EQ-B05",
    name: "三坐标测量仪",
    lineId: "LINE-B",
    stationId: "ST-B03",
    model: "CONTURA",
    manufacturer: "蔡司",
    installDate: "2023-03-20",
    status: "运行中",
  },
  {
    id: "EQ-B06",
    name: "焊缝检测仪",
    lineId: "LINE-B",
    stationId: "ST-B03",
    model: "USM-36",
    manufacturer: "GE",
    installDate: "2023-03-20",
    status: "运行中",
  },
]

export const maintenanceRecords: MaintenanceRecord[] = [
  {
    id: "MNT-001",
    equipmentId: "EQ-A01",
    equipmentName: "800T冲压机",
    type: "定期保养",
    description: "润滑系统保养，更换液压油",
    startTime: dayOf(0, 6),
    endTime: dayOf(0, 10),
    technicianId: "EMP-005",
    status: "已完成",
    cost: 3500,
    spareParts: ["SP-001", "SP-002"],
  },
  {
    id: "MNT-002",
    equipmentId: "EQ-B02",
    equipmentName: "点焊机器人2",
    type: "故障维修",
    description: "焊枪电极磨损严重，更换电极头",
    startTime: dayOf(1, 9),
    endTime: dayOf(1, 14),
    technicianId: "EMP-010",
    status: "已完成",
    cost: 1200,
    spareParts: ["SP-006"],
  },
  {
    id: "MNT-003",
    equipmentId: "EQ-A03",
    equipmentName: "数控冲床",
    type: "预防性维护",
    description: "主轴精度校准",
    startTime: dayOf(1, 14),
    endTime: dayOf(1, 17),
    technicianId: "EMP-005",
    status: "已完成",
    cost: 800,
    spareParts: [],
  },
  {
    id: "MNT-004",
    equipmentId: "EQ-B03",
    equipmentName: "弧焊机器人",
    type: "定期保养",
    description: "送丝机构清理，校准焊接参数",
    startTime: dayOf(2, 6),
    endTime: dayOf(2, 9),
    technicianId: "EMP-010",
    status: "已完成",
    cost: 600,
    spareParts: ["SP-007"],
  },
  {
    id: "MNT-005",
    equipmentId: "EQ-A05",
    equipmentName: "修边机",
    type: "故障维修",
    description: "刀具断裂更换",
    startTime: dayOf(2, 14),
    endTime: dayOf(2, 16),
    technicianId: "EMP-015",
    status: "已完成",
    cost: 2200,
    spareParts: ["SP-003"],
  },
  {
    id: "MNT-006",
    equipmentId: "EQ-B05",
    equipmentName: "三坐标测量仪",
    type: "定期保养",
    description: "探头校准及气路检查",
    startTime: dayOf(3, 6),
    endTime: dayOf(3, 8),
    technicianId: "EMP-010",
    status: "已完成",
    cost: 500,
    spareParts: [],
  },
  {
    id: "MNT-007",
    equipmentId: "EQ-A02",
    equipmentName: "400T冲压机",
    type: "预防性维护",
    description: "离合器检查，制动器调整",
    startTime: dayOf(3, 14),
    endTime: dayOf(3, 18),
    technicianId: "EMP-015",
    status: "已完成",
    cost: 1500,
    spareParts: ["SP-004"],
  },
  {
    id: "MNT-008",
    equipmentId: "EQ-B02",
    equipmentName: "点焊机器人2",
    type: "故障维修",
    description: "伺服电机异常，更换编码器",
    startTime: dayOf(4, 8),
    technicianId: "EMP-010",
    status: "进行中",
    cost: 4500,
    spareParts: ["SP-008"],
  },
  {
    id: "MNT-009",
    equipmentId: "EQ-B04",
    equipmentName: "弧焊机器人2",
    type: "定期保养",
    description: "减速器润滑及线缆检查",
    startTime: dayOf(4, 14),
    endTime: dayOf(4, 16),
    technicianId: "EMP-020",
    status: "已完成",
    cost: 700,
    spareParts: ["SP-009"],
  },
  {
    id: "MNT-010",
    equipmentId: "EQ-A06",
    equipmentName: "去毛刺机",
    type: "预防性维护",
    description: "砂轮更换及防护罩检查",
    startTime: dayOf(4, 16),
    endTime: dayOf(4, 18),
    technicianId: "EMP-015",
    status: "已完成",
    cost: 400,
    spareParts: ["SP-005"],
  },
]

export const alarmRecords: AlarmRecord[] = [
  {
    id: "ALM-001",
    equipmentId: "EQ-B02",
    equipmentName: "点焊机器人2",
    alarmType: "伺服异常",
    severity: "紧急",
    description: "伺服电机过载报警，已停机",
    timestamp: dayOf(4, 7),
    acknowledged: true,
    resolvedAt: dayOf(4, 8),
  },
  {
    id: "ALM-002",
    equipmentId: "EQ-A01",
    equipmentName: "800T冲压机",
    alarmType: "液压压力低",
    severity: "重要",
    description: "液压系统压力低于设定值",
    timestamp: dayOf(2, 10),
    acknowledged: true,
    resolvedAt: dayOf(2, 11),
  },
  {
    id: "ALM-003",
    equipmentId: "EQ-A05",
    equipmentName: "修边机",
    alarmType: "刀具磨损",
    severity: "一般",
    description: "刀具磨损量接近更换阈值",
    timestamp: dayOf(2, 13),
    acknowledged: true,
    resolvedAt: dayOf(2, 14),
  },
  {
    id: "ALM-004",
    equipmentId: "EQ-B03",
    equipmentName: "弧焊机器人",
    alarmType: "送丝异常",
    severity: "重要",
    description: "送丝速度不稳定",
    timestamp: dayOf(3, 15),
    acknowledged: true,
    resolvedAt: dayOf(3, 16),
  },
  {
    id: "ALM-005",
    equipmentId: "EQ-A03",
    equipmentName: "数控冲床",
    alarmType: "温度过高",
    severity: "一般",
    description: "主轴温度超过警告值",
    timestamp: dayOf(4, 11),
    acknowledged: true,
  },
  {
    id: "ALM-006",
    equipmentId: "EQ-B04",
    equipmentName: "弧焊机器人2",
    alarmType: "气体流量低",
    severity: "重要",
    description: "保护气体流量不足",
    timestamp: dayOf(4, 14),
    acknowledged: false,
  },
]

export const spareParts: SparePart[] = [
  {
    id: "SP-001",
    name: "液压油",
    code: "HYD-46",
    applicableEquipment: ["EQ-A01", "EQ-A02", "EQ-A04"],
    stock: 200,
    minStock: 50,
    unit: "L",
    unitPrice: 35,
  },
  {
    id: "SP-002",
    name: "油封套件",
    code: "SEAL-A01",
    applicableEquipment: ["EQ-A01", "EQ-A02"],
    stock: 12,
    minStock: 4,
    unit: "套",
    unitPrice: 280,
  },
  {
    id: "SP-003",
    name: "修边刀具",
    code: "BLADE-TB",
    applicableEquipment: ["EQ-A05"],
    stock: 8,
    minStock: 3,
    unit: "把",
    unitPrice: 650,
  },
  {
    id: "SP-004",
    name: "离合器片",
    code: "CLT-JH21",
    applicableEquipment: ["EQ-A01", "EQ-A02"],
    stock: 4,
    minStock: 2,
    unit: "片",
    unitPrice: 1200,
  },
  {
    id: "SP-005",
    name: "砂轮片",
    code: "GRD-DB50",
    applicableEquipment: ["EQ-A06"],
    stock: 20,
    minStock: 5,
    unit: "片",
    unitPrice: 85,
  },
  {
    id: "SP-006",
    name: "点焊电极头",
    code: "ELEC-IRB",
    applicableEquipment: ["EQ-B01", "EQ-B02"],
    stock: 30,
    minStock: 10,
    unit: "个",
    unitPrice: 45,
  },
  {
    id: "SP-007",
    name: "送丝轮",
    code: "FEED-ARC",
    applicableEquipment: ["EQ-B03", "EQ-B04"],
    stock: 6,
    minStock: 2,
    unit: "个",
    unitPrice: 320,
  },
  {
    id: "SP-008",
    name: "伺服编码器",
    code: "ENC-ABB",
    applicableEquipment: ["EQ-B01", "EQ-B02"],
    stock: 2,
    minStock: 1,
    unit: "个",
    unitPrice: 3500,
  },
  {
    id: "SP-009",
    name: "减速器润滑脂",
    code: "GRS-RV",
    applicableEquipment: ["EQ-B01", "EQ-B02", "EQ-B03", "EQ-B04"],
    stock: 15,
    minStock: 5,
    unit: "kg",
    unitPrice: 120,
  },
  {
    id: "SP-010",
    name: "冲头",
    code: "PUN-VT",
    applicableEquipment: ["EQ-A03"],
    stock: 10,
    minStock: 3,
    unit: "个",
    unitPrice: 450,
  },
  {
    id: "SP-011",
    name: "模具弹簧",
    code: "SPR-DIE",
    applicableEquipment: ["EQ-A01", "EQ-A02", "EQ-A03"],
    stock: 25,
    minStock: 8,
    unit: "根",
    unitPrice: 65,
  },
  {
    id: "SP-012",
    name: "导电嘴",
    code: "TIP-ARC",
    applicableEquipment: ["EQ-B03", "EQ-B04"],
    stock: 50,
    minStock: 15,
    unit: "个",
    unitPrice: 12,
  },
  {
    id: "SP-013",
    name: "测量探头",
    code: "PROBE-ZS",
    applicableEquipment: ["EQ-B05"],
    stock: 3,
    minStock: 1,
    unit: "个",
    unitPrice: 8500,
  },
  {
    id: "SP-014",
    name: "超声耦合剂",
    code: "COUP-GE",
    applicableEquipment: ["EQ-B06"],
    stock: 10,
    minStock: 3,
    unit: "瓶",
    unitPrice: 95,
  },
  {
    id: "SP-015",
    name: "防护气瓶",
    code: "GAS-AR",
    applicableEquipment: ["EQ-B03", "EQ-B04"],
    stock: 8,
    minStock: 3,
    unit: "瓶",
    unitPrice: 180,
  },
]
