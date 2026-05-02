// 能源数据 - 能耗记录、能源报警

export interface EnergyConsumption {
  id: string
  date: Date
  lineId: string
  lineName: string
  electricity: number // kWh
  water: number // 吨
  gas: number // 立方米
  productionHours: number
  energyCostPerUnit: number // 元/件
}

export interface EnergyAlarm {
  id: string
  lineId: string
  lineName: string
  type: string
  description: string
  timestamp: Date
  value: number
  threshold: number
  unit: string
  status: "已处理" | "未处理"
}

const today = new Date()
const monday = new Date(today)
monday.setDate(today.getDate() - today.getDay() + 1)
monday.setHours(0, 0, 0, 0)

function dayOf(offset: number, hour = 0): Date {
  const d = new Date(monday)
  d.setDate(monday.getDate() + offset)
  d.setHours(hour, 0, 0, 0)
  return d
}

export const energyConsumption: EnergyConsumption[] = [
  // LINE-A 周一至周日
  {
    id: "EN-A-1",
    date: dayOf(0),
    lineId: "LINE-A",
    lineName: "冲压线A",
    electricity: 2850,
    water: 12.5,
    gas: 45,
    productionHours: 16,
    energyCostPerUnit: 3.2,
  },
  {
    id: "EN-A-2",
    date: dayOf(1),
    lineId: "LINE-A",
    lineName: "冲压线A",
    electricity: 3100,
    water: 13.2,
    gas: 48,
    productionHours: 16,
    energyCostPerUnit: 2.9,
  },
  {
    id: "EN-A-3",
    date: dayOf(2),
    lineId: "LINE-A",
    lineName: "冲压线A",
    electricity: 2950,
    water: 12.8,
    gas: 46,
    productionHours: 16,
    energyCostPerUnit: 3.1,
  },
  {
    id: "EN-A-4",
    date: dayOf(3),
    lineId: "LINE-A",
    lineName: "冲压线A",
    electricity: 3200,
    water: 14.0,
    gas: 50,
    productionHours: 16,
    energyCostPerUnit: 2.8,
  },
  {
    id: "EN-A-5",
    date: dayOf(4),
    lineId: "LINE-A",
    lineName: "冲压线A",
    electricity: 3050,
    water: 13.5,
    gas: 47,
    productionHours: 16,
    energyCostPerUnit: 3.0,
  },
  {
    id: "EN-A-6",
    date: dayOf(5),
    lineId: "LINE-A",
    lineName: "冲压线A",
    electricity: 2700,
    water: 11.0,
    gas: 42,
    productionHours: 8,
    energyCostPerUnit: 3.5,
  },
  {
    id: "EN-A-7",
    date: dayOf(6),
    lineId: "LINE-A",
    lineName: "冲压线A",
    electricity: 500,
    water: 2.0,
    gas: 5,
    productionHours: 0,
    energyCostPerUnit: 0,
  },
  // LINE-B 周一至周日
  {
    id: "EN-B-1",
    date: dayOf(0),
    lineId: "LINE-B",
    lineName: "焊接线B",
    electricity: 3500,
    water: 8.5,
    gas: 120,
    productionHours: 16,
    energyCostPerUnit: 4.5,
  },
  {
    id: "EN-B-2",
    date: dayOf(1),
    lineId: "LINE-B",
    lineName: "焊接线B",
    electricity: 3800,
    water: 9.0,
    gas: 130,
    productionHours: 16,
    energyCostPerUnit: 4.2,
  },
  {
    id: "EN-B-3",
    date: dayOf(2),
    lineId: "LINE-B",
    lineName: "焊接线B",
    electricity: 3600,
    water: 8.8,
    gas: 125,
    productionHours: 16,
    energyCostPerUnit: 4.3,
  },
  {
    id: "EN-B-4",
    date: dayOf(3),
    lineId: "LINE-B",
    lineName: "焊接线B",
    electricity: 3900,
    water: 9.5,
    gas: 135,
    productionHours: 16,
    energyCostPerUnit: 4.1,
  },
  {
    id: "EN-B-5",
    date: dayOf(4),
    lineId: "LINE-B",
    lineName: "焊接线B",
    electricity: 3700,
    water: 9.2,
    gas: 128,
    productionHours: 16,
    energyCostPerUnit: 4.4,
  },
  {
    id: "EN-B-6",
    date: dayOf(5),
    lineId: "LINE-B",
    lineName: "焊接线B",
    electricity: 3200,
    water: 7.0,
    gas: 100,
    productionHours: 8,
    energyCostPerUnit: 5.0,
  },
  {
    id: "EN-B-7",
    date: dayOf(6),
    lineId: "LINE-B",
    lineName: "焊接线B",
    electricity: 600,
    water: 1.5,
    gas: 8,
    productionHours: 0,
    energyCostPerUnit: 0,
  },
]

export const energyAlarms: EnergyAlarm[] = [
  {
    id: "EA-001",
    lineId: "LINE-A",
    lineName: "冲压线A",
    type: "用电量超标",
    description: "冲压线A单日用电量超过3000kWh阈值",
    timestamp: dayOf(1, 18),
    value: 3100,
    threshold: 3000,
    unit: "kWh",
    status: "已处理",
  },
  {
    id: "EA-002",
    lineId: "LINE-B",
    lineName: "焊接线B",
    type: "燃气用量异常",
    description: "焊接线B燃气用量超过130m³阈值",
    timestamp: dayOf(1, 20),
    value: 130,
    threshold: 128,
    unit: "m³",
    status: "已处理",
  },
  {
    id: "EA-003",
    lineId: "LINE-B",
    lineName: "焊接线B",
    type: "用电量超标",
    description: "焊接线B单日用电量超过3800kWh阈值",
    timestamp: dayOf(3, 17),
    value: 3900,
    threshold: 3800,
    unit: "kWh",
    status: "未处理",
  },
  {
    id: "EA-004",
    lineId: "LINE-A",
    lineName: "冲压线A",
    type: "用水量异常",
    description: "冲压线A单日用水量超过13.5吨阈值",
    timestamp: dayOf(3, 15),
    value: 14.0,
    threshold: 13.5,
    unit: "吨",
    status: "未处理",
  },
]
