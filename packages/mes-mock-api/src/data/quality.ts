// 质量数据 - 检验记录、缺陷记录、SPC数据

export interface InspectionRecord {
  id: string
  orderId: string
  productName: string
  inspectorId: string
  inspectionDate: Date
  result: "合格" | "不合格"
  sampleSize: number
  defectCount: number
  parameters: { name: string; value: number; standard: number; tolerance: number; pass: boolean }[]
}

export interface DefectRecord {
  id: string
  orderId: string
  stationId: string
  productName: string
  defectType: string
  severity: "严重" | "一般" | "轻微"
  description: string
  discoveredAt: Date
  operatorId: string
  status: "已处理" | "处理中" | "待处理"
}

export interface SPCDataPoint {
  timestamp: Date
  parameterId: string
  parameterName: string
  value: number
  ucl: number
  lcl: number
  cl: number
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

export const inspectionRecords: InspectionRecord[] = [
  {
    id: "QC-001",
    orderId: "PO-001",
    productName: "前保险杠支架",
    inspectorId: "EMP-004",
    inspectionDate: dayOf(0),
    result: "合格",
    sampleSize: 20,
    defectCount: 0,
    parameters: [
      { name: "长度", value: 450.2, standard: 450, tolerance: 0.5, pass: true },
      { name: "宽度", value: 120.1, standard: 120, tolerance: 0.3, pass: true },
    ],
  },
  {
    id: "QC-002",
    orderId: "PO-001",
    productName: "前保险杠支架",
    inspectorId: "EMP-004",
    inspectionDate: dayOf(0, 14),
    result: "合格",
    sampleSize: 20,
    defectCount: 1,
    parameters: [
      { name: "长度", value: 450.3, standard: 450, tolerance: 0.5, pass: true },
      { name: "宽度", value: 120.0, standard: 120, tolerance: 0.3, pass: true },
    ],
  },
  {
    id: "QC-003",
    orderId: "PO-002",
    productName: "后防撞梁",
    inspectorId: "EMP-009",
    inspectionDate: dayOf(0, 10),
    result: "合格",
    sampleSize: 15,
    defectCount: 0,
    parameters: [{ name: "焊缝强度", value: 340, standard: 330, tolerance: 20, pass: true }],
  },
  {
    id: "QC-004",
    orderId: "PO-002",
    productName: "后防撞梁",
    inspectorId: "EMP-009",
    inspectionDate: dayOf(1),
    result: "不合格",
    sampleSize: 15,
    defectCount: 3,
    parameters: [{ name: "焊缝强度", value: 305, standard: 330, tolerance: 20, pass: false }],
  },
  {
    id: "QC-005",
    orderId: "PO-003",
    productName: "车门铰链",
    inspectorId: "EMP-004",
    inspectionDate: dayOf(1),
    result: "合格",
    sampleSize: 30,
    defectCount: 0,
    parameters: [{ name: "转动力矩", value: 2.5, standard: 2.5, tolerance: 0.3, pass: true }],
  },
  {
    id: "QC-006",
    orderId: "PO-003",
    productName: "车门铰链",
    inspectorId: "EMP-014",
    inspectionDate: dayOf(1, 16),
    result: "合格",
    sampleSize: 30,
    defectCount: 1,
    parameters: [{ name: "转动力矩", value: 2.6, standard: 2.5, tolerance: 0.3, pass: true }],
  },
  {
    id: "QC-007",
    orderId: "PO-004",
    productName: "发动机支架",
    inspectorId: "EMP-009",
    inspectionDate: dayOf(1, 10),
    result: "合格",
    sampleSize: 10,
    defectCount: 0,
    parameters: [{ name: "焊缝强度", value: 520, standard: 500, tolerance: 30, pass: true }],
  },
  {
    id: "QC-008",
    orderId: "PO-004",
    productName: "发动机支架",
    inspectorId: "EMP-009",
    inspectionDate: dayOf(2),
    result: "合格",
    sampleSize: 10,
    defectCount: 0,
    parameters: [{ name: "焊缝强度", value: 515, standard: 500, tolerance: 30, pass: true }],
  },
  {
    id: "QC-009",
    orderId: "PO-005",
    productName: "排气管法兰",
    inspectorId: "EMP-014",
    inspectionDate: dayOf(2),
    result: "合格",
    sampleSize: 25,
    defectCount: 0,
    parameters: [{ name: "平面度", value: 0.08, standard: 0.1, tolerance: 0.05, pass: true }],
  },
  {
    id: "QC-010",
    orderId: "PO-005",
    productName: "排气管法兰",
    inspectorId: "EMP-004",
    inspectionDate: dayOf(2, 14),
    result: "不合格",
    sampleSize: 25,
    defectCount: 4,
    parameters: [{ name: "平面度", value: 0.18, standard: 0.1, tolerance: 0.05, pass: false }],
  },
  {
    id: "QC-011",
    orderId: "PO-006",
    productName: "前保险杠支架",
    inspectorId: "EMP-004",
    inspectionDate: dayOf(3),
    result: "合格",
    sampleSize: 20,
    defectCount: 0,
    parameters: [{ name: "长度", value: 449.8, standard: 450, tolerance: 0.5, pass: true }],
  },
  {
    id: "QC-012",
    orderId: "PO-006",
    productName: "前保险杠支架",
    inspectorId: "EMP-019",
    inspectionDate: dayOf(3, 16),
    result: "合格",
    sampleSize: 20,
    defectCount: 1,
    parameters: [{ name: "长度", value: 450.1, standard: 450, tolerance: 0.5, pass: true }],
  },
  {
    id: "QC-013",
    orderId: "PO-007",
    productName: "后防撞梁",
    inspectorId: "EMP-009",
    inspectionDate: dayOf(3, 10),
    result: "合格",
    sampleSize: 15,
    defectCount: 0,
    parameters: [{ name: "焊缝强度", value: 345, standard: 330, tolerance: 20, pass: true }],
  },
  {
    id: "QC-014",
    orderId: "PO-007",
    productName: "后防撞梁",
    inspectorId: "EMP-009",
    inspectionDate: dayOf(4),
    result: "不合格",
    sampleSize: 15,
    defectCount: 2,
    parameters: [{ name: "焊缝强度", value: 308, standard: 330, tolerance: 20, pass: false }],
  },
  {
    id: "QC-015",
    orderId: "PO-008",
    productName: "车门铰链",
    inspectorId: "EMP-014",
    inspectionDate: dayOf(3),
    result: "合格",
    sampleSize: 30,
    defectCount: 0,
    parameters: [{ name: "转动力矩", value: 2.4, standard: 2.5, tolerance: 0.3, pass: true }],
  },
  {
    id: "QC-016",
    orderId: "PO-008",
    productName: "车门铰链",
    inspectorId: "EMP-004",
    inspectionDate: dayOf(4),
    result: "合格",
    sampleSize: 30,
    defectCount: 0,
    parameters: [{ name: "转动力矩", value: 2.5, standard: 2.5, tolerance: 0.3, pass: true }],
  },
  {
    id: "QC-017",
    orderId: "PO-009",
    productName: "发动机支架",
    inspectorId: "EMP-019",
    inspectionDate: dayOf(4),
    result: "合格",
    sampleSize: 10,
    defectCount: 0,
    parameters: [{ name: "焊缝强度", value: 510, standard: 500, tolerance: 30, pass: true }],
  },
  {
    id: "QC-018",
    orderId: "PO-009",
    productName: "发动机支架",
    inspectorId: "EMP-009",
    inspectionDate: dayOf(4, 14),
    result: "合格",
    sampleSize: 10,
    defectCount: 1,
    parameters: [{ name: "焊缝强度", value: 498, standard: 500, tolerance: 30, pass: true }],
  },
  {
    id: "QC-019",
    orderId: "PO-010",
    productName: "排气管法兰",
    inspectorId: "EMP-014",
    inspectionDate: dayOf(4),
    result: "合格",
    sampleSize: 25,
    defectCount: 0,
    parameters: [{ name: "平面度", value: 0.07, standard: 0.1, tolerance: 0.05, pass: true }],
  },
  {
    id: "QC-020",
    orderId: "PO-010",
    productName: "排气管法兰",
    inspectorId: "EMP-004",
    inspectionDate: dayOf(4, 16),
    result: "不合格",
    sampleSize: 25,
    defectCount: 3,
    parameters: [{ name: "平面度", value: 0.16, standard: 0.1, tolerance: 0.05, pass: false }],
  },
]

export const defectRecords: DefectRecord[] = [
  {
    id: "DEF-001",
    orderId: "PO-002",
    stationId: "ST-B02",
    productName: "后防撞梁",
    defectType: "焊缝气孔",
    severity: "严重",
    description: "弧焊焊缝存在密集气孔，强度不达标",
    discoveredAt: dayOf(1, 11),
    operatorId: "EMP-007",
    status: "已处理",
  },
  {
    id: "DEF-002",
    orderId: "PO-005",
    stationId: "ST-A02",
    productName: "排气管法兰",
    defectType: "平面度超差",
    severity: "一般",
    description: "冲压后平面度0.18mm，超出公差",
    discoveredAt: dayOf(2, 15),
    operatorId: "EMP-003",
    status: "已处理",
  },
  {
    id: "DEF-003",
    orderId: "PO-001",
    stationId: "ST-A03",
    productName: "前保险杠支架",
    defectType: "毛刺",
    severity: "轻微",
    description: "修边后局部残留毛刺",
    discoveredAt: dayOf(0, 15),
    operatorId: "EMP-002",
    status: "已处理",
  },
  {
    id: "DEF-004",
    orderId: "PO-007",
    stationId: "ST-B02",
    productName: "后防撞梁",
    defectType: "焊接变形",
    severity: "严重",
    description: "焊接热变形超出允许范围",
    discoveredAt: dayOf(4, 9),
    operatorId: "EMP-008",
    status: "处理中",
  },
  {
    id: "DEF-005",
    orderId: "PO-006",
    stationId: "ST-A01",
    productName: "前保险杠支架",
    defectType: "划痕",
    severity: "轻微",
    description: "冲压模具划伤表面",
    discoveredAt: dayOf(3, 10),
    operatorId: "EMP-012",
    status: "已处理",
  },
  {
    id: "DEF-006",
    orderId: "PO-010",
    stationId: "ST-A02",
    productName: "排气管法兰",
    defectType: "尺寸超差",
    severity: "一般",
    description: "冲孔位置偏移0.5mm",
    discoveredAt: dayOf(4, 17),
    operatorId: "EMP-018",
    status: "处理中",
  },
  {
    id: "DEF-007",
    orderId: "PO-009",
    stationId: "ST-B01",
    productName: "发动机支架",
    defectType: "焊点脱落",
    severity: "严重",
    description: "点焊连接不牢固",
    discoveredAt: dayOf(4, 15),
    operatorId: "EMP-017",
    status: "待处理",
  },
  {
    id: "DEF-008",
    orderId: "PO-008",
    stationId: "ST-A01",
    productName: "车门铰链",
    defectType: "裂纹",
    severity: "严重",
    description: "冲压边缘出现微裂纹",
    discoveredAt: dayOf(3, 14),
    operatorId: "EMP-005",
    status: "处理中",
  },
]

// SPC数据 - 前保险杠支架长度 & 后防撞梁焊缝强度
function generateSPCData(
  parameterId: string,
  parameterName: string,
  cl: number,
  ucl: number,
  lcl: number,
  count: number,
): SPCDataPoint[] {
  const range = ucl - lcl
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(monday)
    d.setHours(6 + Math.floor(i / 4), (i % 4) * 15, 0, 0)
    d.setDate(monday.getDate() + Math.floor(i / 24))
    // 模拟正态分布波动
    const noise = (Math.random() - 0.5) * range * 0.6
    return {
      timestamp: d,
      parameterId,
      parameterName,
      value: Math.round((cl + noise) * 100) / 100,
      ucl,
      lcl,
      cl,
    }
  })
}

export const spcData: SPCDataPoint[] = [
  ...generateSPCData("SPC-LENGTH", "前保险杠支架长度(mm)", 450, 450.5, 449.5, 50),
  ...generateSPCData("SPC-WELD", "后防撞梁焊缝强度(MPa)", 330, 350, 310, 50),
]
