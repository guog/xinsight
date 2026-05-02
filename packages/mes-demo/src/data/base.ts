// 基础数据 - 工厂模型、班次、班组、物料、人员

export interface ProductionLine {
  id: string
  name: string
  description: string
  stationCount: number
}

export interface Station {
  id: string
  lineId: string
  name: string
  type: string
  sequence: number
}

export interface Shift {
  id: string
  name: string
  startTime: string
  endTime: string
}

export interface Team {
  id: string
  name: string
  leader: string
  memberCount: number
}

export interface Material {
  id: string
  name: string
  code: string
  category: "原材料" | "半成品" | "成品"
  unit: string
  specification: string
}

export interface Personnel {
  id: string
  name: string
  teamId: string
  role: string
  skillLevel: "初级" | "中级" | "高级"
  certifications: string[]
}

// 产线
export const productionLines: ProductionLine[] = [
  { id: "LINE-A", name: "冲压线A", description: "冲压成型产线", stationCount: 3 },
  { id: "LINE-B", name: "焊接线B", description: "焊接组装产线", stationCount: 3 },
]

// 工位
export const stations: Station[] = [
  { id: "ST-A01", lineId: "LINE-A", name: "冲压工位1", type: "冲压", sequence: 1 },
  { id: "ST-A02", lineId: "LINE-A", name: "冲压工位2", type: "冲压", sequence: 2 },
  { id: "ST-A03", lineId: "LINE-A", name: "修边工位", type: "修边", sequence: 3 },
  { id: "ST-B01", lineId: "LINE-B", name: "点焊工位", type: "焊接", sequence: 1 },
  { id: "ST-B02", lineId: "LINE-B", name: "弧焊工位", type: "焊接", sequence: 2 },
  { id: "ST-B03", lineId: "LINE-B", name: "检测工位", type: "检测", sequence: 3 },
]

// 班次
export const shifts: Shift[] = [
  { id: "SHIFT-1", name: "早班", startTime: "06:00", endTime: "14:00" },
  { id: "SHIFT-2", name: "中班", startTime: "14:00", endTime: "22:00" },
  { id: "SHIFT-3", name: "晚班", startTime: "22:00", endTime: "06:00" },
]

// 班组
export const teams: Team[] = [
  { id: "TEAM-1", name: "甲班", leader: "张伟", memberCount: 5 },
  { id: "TEAM-2", name: "乙班", leader: "李强", memberCount: 5 },
  { id: "TEAM-3", name: "丙班", leader: "王磊", memberCount: 5 },
  { id: "TEAM-4", name: "丁班", leader: "刘洋", memberCount: 5 },
]

// 物料 (5原材料 + 5半成品 + 5成品)
export const materials: Material[] = [
  // 原材料
  {
    id: "MAT-R01",
    name: "热轧钢板",
    code: "R-HRC-001",
    category: "原材料",
    unit: "kg",
    specification: "Q235B 3mm",
  },
  {
    id: "MAT-R02",
    name: "冷轧钢板",
    code: "R-CRC-001",
    category: "原材料",
    unit: "kg",
    specification: "DC04 1.5mm",
  },
  {
    id: "MAT-R03",
    name: "不锈钢管",
    code: "R-SST-001",
    category: "原材料",
    unit: "根",
    specification: "304 φ48×3",
  },
  {
    id: "MAT-R04",
    name: "焊丝",
    code: "R-WW-001",
    category: "原材料",
    unit: "盘",
    specification: "ER50-6 φ1.2",
  },
  {
    id: "MAT-R05",
    name: "螺栓组件",
    code: "R-BLT-001",
    category: "原材料",
    unit: "套",
    specification: "M10×30 8.8级",
  },
  // 半成品
  {
    id: "MAT-S01",
    name: "前保支架冲压件",
    code: "S-FBS-001",
    category: "半成品",
    unit: "件",
    specification: "冲压半成品",
  },
  {
    id: "MAT-S02",
    name: "后防撞梁管件",
    code: "S-RCB-001",
    category: "半成品",
    unit: "件",
    specification: "弯管半成品",
  },
  {
    id: "MAT-S03",
    name: "铰链毛坯",
    code: "S-HNG-001",
    category: "半成品",
    unit: "件",
    specification: "锻造毛坯",
  },
  {
    id: "MAT-S04",
    name: "支架焊接组件",
    code: "S-EMS-001",
    category: "半成品",
    unit: "件",
    specification: "焊接半成品",
  },
  {
    id: "MAT-S05",
    name: "法兰冲压件",
    code: "S-EXF-001",
    category: "半成品",
    unit: "件",
    specification: "冲压半成品",
  },
  // 成品
  {
    id: "MAT-F01",
    name: "前保险杠支架",
    code: "F-FBS-001",
    category: "成品",
    unit: "件",
    specification: "总成件",
  },
  {
    id: "MAT-F02",
    name: "后防撞梁",
    code: "F-RCB-001",
    category: "成品",
    unit: "件",
    specification: "总成件",
  },
  {
    id: "MAT-F03",
    name: "车门铰链",
    code: "F-HNG-001",
    category: "成品",
    unit: "套",
    specification: "总成件",
  },
  {
    id: "MAT-F04",
    name: "发动机支架",
    code: "F-EMS-001",
    category: "成品",
    unit: "件",
    specification: "总成件",
  },
  {
    id: "MAT-F05",
    name: "排气管法兰",
    code: "F-EXF-001",
    category: "成品",
    unit: "件",
    specification: "总成件",
  },
]

// 人员
export const personnel: Personnel[] = [
  {
    id: "EMP-001",
    name: "张伟",
    teamId: "TEAM-1",
    role: "班组长",
    skillLevel: "高级",
    certifications: ["冲压操作证", "质量检验证"],
  },
  {
    id: "EMP-002",
    name: "李娜",
    teamId: "TEAM-1",
    role: "操作工",
    skillLevel: "中级",
    certifications: ["冲压操作证"],
  },
  {
    id: "EMP-003",
    name: "王芳",
    teamId: "TEAM-1",
    role: "操作工",
    skillLevel: "中级",
    certifications: ["冲压操作证"],
  },
  {
    id: "EMP-004",
    name: "赵敏",
    teamId: "TEAM-1",
    role: "质检员",
    skillLevel: "高级",
    certifications: ["质量检验证"],
  },
  {
    id: "EMP-005",
    name: "陈刚",
    teamId: "TEAM-1",
    role: "操作工",
    skillLevel: "初级",
    certifications: ["冲压操作证"],
  },
  {
    id: "EMP-006",
    name: "李强",
    teamId: "TEAM-2",
    role: "班组长",
    skillLevel: "高级",
    certifications: ["焊接操作证", "质量检验证"],
  },
  {
    id: "EMP-007",
    name: "周杰",
    teamId: "TEAM-2",
    role: "操作工",
    skillLevel: "中级",
    certifications: ["焊接操作证"],
  },
  {
    id: "EMP-008",
    name: "吴丽",
    teamId: "TEAM-2",
    role: "操作工",
    skillLevel: "中级",
    certifications: ["焊接操作证"],
  },
  {
    id: "EMP-009",
    name: "郑华",
    teamId: "TEAM-2",
    role: "质检员",
    skillLevel: "中级",
    certifications: ["质量检验证"],
  },
  {
    id: "EMP-010",
    name: "孙涛",
    teamId: "TEAM-2",
    role: "操作工",
    skillLevel: "初级",
    certifications: ["焊接操作证"],
  },
  {
    id: "EMP-011",
    name: "王磊",
    teamId: "TEAM-3",
    role: "班组长",
    skillLevel: "高级",
    certifications: ["冲压操作证", "焊接操作证"],
  },
  {
    id: "EMP-012",
    name: "黄丽",
    teamId: "TEAM-3",
    role: "操作工",
    skillLevel: "中级",
    certifications: ["冲压操作证"],
  },
  {
    id: "EMP-013",
    name: "林峰",
    teamId: "TEAM-3",
    role: "操作工",
    skillLevel: "中级",
    certifications: ["焊接操作证"],
  },
  {
    id: "EMP-014",
    name: "徐静",
    teamId: "TEAM-3",
    role: "质检员",
    skillLevel: "高级",
    certifications: ["质量检验证"],
  },
  {
    id: "EMP-015",
    name: "马超",
    teamId: "TEAM-3",
    role: "操作工",
    skillLevel: "初级",
    certifications: ["冲压操作证"],
  },
  {
    id: "EMP-016",
    name: "刘洋",
    teamId: "TEAM-4",
    role: "班组长",
    skillLevel: "高级",
    certifications: ["焊接操作证", "质量检验证"],
  },
  {
    id: "EMP-017",
    name: "杨帆",
    teamId: "TEAM-4",
    role: "操作工",
    skillLevel: "中级",
    certifications: ["焊接操作证"],
  },
  {
    id: "EMP-018",
    name: "胡敏",
    teamId: "TEAM-4",
    role: "操作工",
    skillLevel: "中级",
    certifications: ["冲压操作证"],
  },
  {
    id: "EMP-019",
    name: "罗勇",
    teamId: "TEAM-4",
    role: "质检员",
    skillLevel: "中级",
    certifications: ["质量检验证"],
  },
  {
    id: "EMP-020",
    name: "高飞",
    teamId: "TEAM-4",
    role: "操作工",
    skillLevel: "初级",
    certifications: ["焊接操作证"],
  },
]
