// 追溯数据 - 成品全链路追溯（工单→物料→工序→质检→操作人员）

export interface TraceabilityRecord {
  id: string
  productId: string
  productName: string
  serialNumber: string
  orderId: string
  completedAt: Date
  materials: TraceMaterial[]
  processSteps: TraceProcessStep[]
  qualityChecks: TraceQualityCheck[]
}

export interface TraceMaterial {
  materialId: string
  materialName: string
  batchNumber: string
  quantity: number
  unit: string
  supplierId: string
  supplierName: string
}

export interface TraceProcessStep {
  sequence: number
  name: string
  stationId: string
  stationName: string
  operatorId: string
  operatorName: string
  startTime: Date
  endTime: Date
  parameters: Record<string, number | string>
}

export interface TraceQualityCheck {
  inspectionId: string
  type: string
  result: "合格" | "不合格"
  inspectorId: string
  inspectorName: string
  timestamp: Date
  details: string
}

const today = new Date()
const monday = new Date(today)
monday.setDate(today.getDate() - today.getDay() + 1)
monday.setHours(0, 0, 0, 0)

function dayOf(offset: number, hour = 8, minute = 0): Date {
  const d = new Date(monday)
  d.setDate(monday.getDate() + offset)
  d.setHours(hour, minute, 0, 0)
  return d
}

export const traceabilityRecords: TraceabilityRecord[] = [
  {
    id: "TRACE-001",
    productId: "MAT-F01",
    productName: "前保险杠支架",
    serialNumber: "FBS-20250428-001",
    orderId: "PO-001",
    completedAt: dayOf(0, 17),
    materials: [
      {
        materialId: "MAT-R01",
        materialName: "热轧钢板",
        batchNumber: "B-HRC-20250425",
        quantity: 2.5,
        unit: "kg",
        supplierId: "SUP-001",
        supplierName: "宝钢集团",
      },
      {
        materialId: "MAT-R05",
        materialName: "螺栓组件",
        batchNumber: "B-BLT-20250420",
        quantity: 4,
        unit: "套",
        supplierId: "SUP-003",
        supplierName: "晋亿实业",
      },
    ],
    processSteps: [
      {
        sequence: 1,
        name: "下料",
        stationId: "ST-A01",
        stationName: "冲压工位1",
        operatorId: "EMP-002",
        operatorName: "李娜",
        startTime: dayOf(0, 6, 0),
        endTime: dayOf(0, 6, 30),
        parameters: { 板厚: 3.0, 下料尺寸: "500×200mm" },
      },
      {
        sequence: 2,
        name: "冲压成型",
        stationId: "ST-A02",
        stationName: "冲压工位2",
        operatorId: "EMP-003",
        operatorName: "王芳",
        startTime: dayOf(0, 7, 0),
        endTime: dayOf(0, 7, 45),
        parameters: { 冲压力: 650, 模具编号: "M-FBS-01" },
      },
      {
        sequence: 3,
        name: "修边冲孔",
        stationId: "ST-A03",
        stationName: "修边工位",
        operatorId: "EMP-002",
        operatorName: "李娜",
        startTime: dayOf(0, 8, 0),
        endTime: dayOf(0, 8, 35),
        parameters: { 孔径: 10.5, 孔数: 6 },
      },
      {
        sequence: 4,
        name: "焊接加强筋",
        stationId: "ST-B01",
        stationName: "点焊工位",
        operatorId: "EMP-007",
        operatorName: "周杰",
        startTime: dayOf(0, 9, 0),
        endTime: dayOf(0, 10, 0),
        parameters: { 焊接电流: 8500, 焊点数: 12 },
      },
      {
        sequence: 5,
        name: "终检",
        stationId: "ST-B03",
        stationName: "检测工位",
        operatorId: "EMP-004",
        operatorName: "赵敏",
        startTime: dayOf(0, 10, 30),
        endTime: dayOf(0, 11, 10),
        parameters: { 长度偏差: 0.2, 宽度偏差: 0.1 },
      },
    ],
    qualityChecks: [
      {
        inspectionId: "QC-001",
        type: "首件检验",
        result: "合格",
        inspectorId: "EMP-004",
        inspectorName: "赵敏",
        timestamp: dayOf(0, 7, 50),
        details: "首件尺寸合格，外观无缺陷",
      },
      {
        inspectionId: "QC-001",
        type: "终检",
        result: "合格",
        inspectorId: "EMP-004",
        inspectorName: "赵敏",
        timestamp: dayOf(0, 11, 10),
        details: "尺寸、外观、焊接强度均合格",
      },
    ],
  },
  {
    id: "TRACE-002",
    productId: "MAT-F02",
    productName: "后防撞梁",
    serialNumber: "RCB-20250428-001",
    orderId: "PO-002",
    completedAt: dayOf(1, 17),
    materials: [
      {
        materialId: "MAT-R03",
        materialName: "不锈钢管",
        batchNumber: "B-SST-20250422",
        quantity: 1,
        unit: "根",
        supplierId: "SUP-002",
        supplierName: "太钢不锈",
      },
      {
        materialId: "MAT-R04",
        materialName: "焊丝",
        batchNumber: "B-WW-20250420",
        quantity: 0.5,
        unit: "盘",
        supplierId: "SUP-004",
        supplierName: "大西洋焊材",
      },
      {
        materialId: "MAT-R01",
        materialName: "热轧钢板",
        batchNumber: "B-HRC-20250425",
        quantity: 1.2,
        unit: "kg",
        supplierId: "SUP-001",
        supplierName: "宝钢集团",
      },
    ],
    processSteps: [
      {
        sequence: 1,
        name: "管材切割",
        stationId: "ST-A01",
        stationName: "冲压工位1",
        operatorId: "EMP-012",
        operatorName: "黄丽",
        startTime: dayOf(0, 6, 0),
        endTime: dayOf(0, 6, 25),
        parameters: { 切割长度: 1200, 管径: 48 },
      },
      {
        sequence: 2,
        name: "弯管成型",
        stationId: "ST-A02",
        stationName: "冲压工位2",
        operatorId: "EMP-013",
        operatorName: "林峰",
        startTime: dayOf(0, 7, 0),
        endTime: dayOf(0, 7, 50),
        parameters: { 弯曲角度: 15, 弯曲半径: 200 },
      },
      {
        sequence: 3,
        name: "端部冲压",
        stationId: "ST-A03",
        stationName: "修边工位",
        operatorId: "EMP-012",
        operatorName: "黄丽",
        startTime: dayOf(0, 8, 0),
        endTime: dayOf(0, 8, 40),
        parameters: { 压扁宽度: 60, 冲压力: 400 },
      },
      {
        sequence: 4,
        name: "焊接连接板",
        stationId: "ST-B01",
        stationName: "点焊工位",
        operatorId: "EMP-007",
        operatorName: "周杰",
        startTime: dayOf(0, 14, 0),
        endTime: dayOf(0, 14, 55),
        parameters: { 焊接电流: 9000, 焊点数: 8 },
      },
      {
        sequence: 5,
        name: "弧焊加固",
        stationId: "ST-B02",
        stationName: "弧焊工位",
        operatorId: "EMP-008",
        operatorName: "吴丽",
        startTime: dayOf(1, 6, 0),
        endTime: dayOf(1, 7, 5),
        parameters: { 焊接电流: 180, 焊缝长度: 350 },
      },
      {
        sequence: 6,
        name: "终检",
        stationId: "ST-B03",
        stationName: "检测工位",
        operatorId: "EMP-009",
        operatorName: "郑华",
        startTime: dayOf(1, 8, 0),
        endTime: dayOf(1, 8, 45),
        parameters: { 焊缝强度: 340, 尺寸偏差: 0.3 },
      },
    ],
    qualityChecks: [
      {
        inspectionId: "QC-003",
        type: "过程检验",
        result: "合格",
        inspectorId: "EMP-009",
        inspectorName: "郑华",
        timestamp: dayOf(0, 10),
        details: "弯管尺寸合格",
      },
      {
        inspectionId: "QC-003",
        type: "终检",
        result: "合格",
        inspectorId: "EMP-009",
        inspectorName: "郑华",
        timestamp: dayOf(1, 8, 45),
        details: "焊缝探伤合格，尺寸合格",
      },
    ],
  },
  {
    id: "TRACE-003",
    productId: "MAT-F03",
    productName: "车门铰链",
    serialNumber: "HNG-20250429-001",
    orderId: "PO-003",
    completedAt: dayOf(1, 16),
    materials: [
      {
        materialId: "MAT-R02",
        materialName: "冷轧钢板",
        batchNumber: "B-CRC-20250423",
        quantity: 0.3,
        unit: "kg",
        supplierId: "SUP-001",
        supplierName: "宝钢集团",
      },
      {
        materialId: "MAT-R05",
        materialName: "螺栓组件",
        batchNumber: "B-BLT-20250420",
        quantity: 1,
        unit: "套",
        supplierId: "SUP-003",
        supplierName: "晋亿实业",
      },
    ],
    processSteps: [
      {
        sequence: 1,
        name: "冲压",
        stationId: "ST-A01",
        stationName: "冲压工位1",
        operatorId: "EMP-003",
        operatorName: "王芳",
        startTime: dayOf(1, 6, 0),
        endTime: dayOf(1, 6, 20),
        parameters: { 冲压力: 200, 模具编号: "M-HNG-01" },
      },
      {
        sequence: 2,
        name: "冲孔攻丝",
        stationId: "ST-A02",
        stationName: "冲压工位2",
        operatorId: "EMP-002",
        operatorName: "李娜",
        startTime: dayOf(1, 7, 0),
        endTime: dayOf(1, 7, 30),
        parameters: { 孔径: 8.0, 螺距: 1.25 },
      },
      {
        sequence: 3,
        name: "组装",
        stationId: "ST-B01",
        stationName: "点焊工位",
        operatorId: "EMP-008",
        operatorName: "吴丽",
        startTime: dayOf(1, 8, 0),
        endTime: dayOf(1, 8, 40),
        parameters: { 销轴直径: 10, 装配力: 50 },
      },
      {
        sequence: 4,
        name: "终检",
        stationId: "ST-B03",
        stationName: "检测工位",
        operatorId: "EMP-004",
        operatorName: "赵敏",
        startTime: dayOf(1, 9, 0),
        endTime: dayOf(1, 9, 25),
        parameters: { 转动力矩: 2.5, 间隙: 0.05 },
      },
    ],
    qualityChecks: [
      {
        inspectionId: "QC-005",
        type: "终检",
        result: "合格",
        inspectorId: "EMP-004",
        inspectorName: "赵敏",
        timestamp: dayOf(1, 9, 25),
        details: "转动顺畅，力矩合格",
      },
    ],
  },
  {
    id: "TRACE-004",
    productId: "MAT-F04",
    productName: "发动机支架",
    serialNumber: "EMS-20250429-001",
    orderId: "PO-004",
    completedAt: dayOf(2, 16),
    materials: [
      {
        materialId: "MAT-R01",
        materialName: "热轧钢板",
        batchNumber: "B-HRC-20250425",
        quantity: 4.0,
        unit: "kg",
        supplierId: "SUP-001",
        supplierName: "宝钢集团",
      },
      {
        materialId: "MAT-R04",
        materialName: "焊丝",
        batchNumber: "B-WW-20250420",
        quantity: 0.3,
        unit: "盘",
        supplierId: "SUP-004",
        supplierName: "大西洋焊材",
      },
    ],
    processSteps: [
      {
        sequence: 1,
        name: "下料",
        stationId: "ST-A01",
        stationName: "冲压工位1",
        operatorId: "EMP-017",
        operatorName: "杨帆",
        startTime: dayOf(1, 14, 0),
        endTime: dayOf(1, 14, 35),
        parameters: { 板厚: 5.0, 下料尺寸: "300×250mm" },
      },
      {
        sequence: 2,
        name: "冲压成型",
        stationId: "ST-A02",
        stationName: "冲压工位2",
        operatorId: "EMP-018",
        operatorName: "胡敏",
        startTime: dayOf(1, 15, 0),
        endTime: dayOf(1, 15, 55),
        parameters: { 冲压力: 780, 模具编号: "M-EMS-01" },
      },
      {
        sequence: 3,
        name: "焊接组装",
        stationId: "ST-B01",
        stationName: "点焊工位",
        operatorId: "EMP-017",
        operatorName: "杨帆",
        startTime: dayOf(2, 6, 0),
        endTime: dayOf(2, 7, 10),
        parameters: { 焊接电流: 9500, 焊点数: 16 },
      },
      {
        sequence: 4,
        name: "弧焊加固",
        stationId: "ST-B02",
        stationName: "弧焊工位",
        operatorId: "EMP-020",
        operatorName: "高飞",
        startTime: dayOf(2, 8, 0),
        endTime: dayOf(2, 9, 0),
        parameters: { 焊接电流: 200, 焊缝长度: 480 },
      },
      {
        sequence: 5,
        name: "终检",
        stationId: "ST-B03",
        stationName: "检测工位",
        operatorId: "EMP-009",
        operatorName: "郑华",
        startTime: dayOf(2, 10, 0),
        endTime: dayOf(2, 10, 50),
        parameters: { 焊缝强度: 520, 尺寸偏差: 0.2 },
      },
    ],
    qualityChecks: [
      {
        inspectionId: "QC-007",
        type: "过程检验",
        result: "合格",
        inspectorId: "EMP-009",
        inspectorName: "郑华",
        timestamp: dayOf(1, 16),
        details: "冲压件尺寸合格",
      },
      {
        inspectionId: "QC-008",
        type: "终检",
        result: "合格",
        inspectorId: "EMP-009",
        inspectorName: "郑华",
        timestamp: dayOf(2, 10, 50),
        details: "探伤合格，焊缝强度520MPa",
      },
    ],
  },
  {
    id: "TRACE-005",
    productId: "MAT-F05",
    productName: "排气管法兰",
    serialNumber: "EXF-20250430-001",
    orderId: "PO-005",
    completedAt: dayOf(2, 15),
    materials: [
      {
        materialId: "MAT-R01",
        materialName: "热轧钢板",
        batchNumber: "B-HRC-20250425",
        quantity: 0.8,
        unit: "kg",
        supplierId: "SUP-001",
        supplierName: "宝钢集团",
      },
    ],
    processSteps: [
      {
        sequence: 1,
        name: "冲压落料",
        stationId: "ST-A01",
        stationName: "冲压工位1",
        operatorId: "EMP-015",
        operatorName: "马超",
        startTime: dayOf(2, 6, 0),
        endTime: dayOf(2, 6, 20),
        parameters: { 冲压力: 300, 模具编号: "M-EXF-01" },
      },
      {
        sequence: 2,
        name: "冲孔",
        stationId: "ST-A02",
        stationName: "冲压工位2",
        operatorId: "EMP-012",
        operatorName: "黄丽",
        startTime: dayOf(2, 7, 0),
        endTime: dayOf(2, 7, 25),
        parameters: { 孔径: 12, 孔数: 4 },
      },
      {
        sequence: 3,
        name: "终检",
        stationId: "ST-B03",
        stationName: "检测工位",
        operatorId: "EMP-014",
        operatorName: "徐静",
        startTime: dayOf(2, 8, 0),
        endTime: dayOf(2, 8, 20),
        parameters: { 平面度: 0.08, 孔位偏差: 0.1 },
      },
    ],
    qualityChecks: [
      {
        inspectionId: "QC-009",
        type: "终检",
        result: "合格",
        inspectorId: "EMP-014",
        inspectorName: "徐静",
        timestamp: dayOf(2, 8, 20),
        details: "平面度0.08mm合格，孔位精度合格",
      },
    ],
  },
]
