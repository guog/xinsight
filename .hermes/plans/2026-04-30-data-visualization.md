# 数据可视化（Recharts 集成）实现计划

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 让 Agent 在回答数据查询时能输出可交互图表（折线图、柱状图、饼图、面积图），前端自动识别并渲染。

**Architecture:** Agent 输出 markdown 代码块 ` ```chart\n{JSON}\n``` `，前端解析 message parts 中的 text，识别 chart 代码块后渲染 Recharts 组件。不改变 AI SDK 消息协议，纯前端解析 + 渲染。

**Tech Stack:** Recharts, React 19, Next.js 16, Tailwind CSS 4

---

## Task 1: 安装 Recharts 依赖

**Objective:** 添加 recharts 到项目依赖

**Steps:**

```bash
cd ~/xinsight
bun add recharts
```

**Commit:** `feat: add recharts dependency`

---

## Task 2: 定义图表数据协议类型

**Objective:** 创建 chart 数据的 TypeScript 类型定义

**Files:**

- Create: `src/lib/chart/types.ts`

**内容：**

```typescript
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
```

**Commit:** `feat: define chart data protocol types`

---

## Task 3: 实现 chart 代码块解析器

**Objective:** 从 markdown text 中提取 ```chart 代码块并解析为 ChartConfig

**Files:**

- Create: `src/lib/chart/parse-chart-block.ts`
- Create: `src/lib/chart/__tests__/parse-chart-block.test.ts`

**解析逻辑：**

- 用正则匹配 ` ```chart\n...\n``` `
- JSON.parse 内容为 ChartConfig
- 校验 type 必须是 line/bar/pie/area，data 必须是数组
- 返回 `{ before: string, chart: ChartConfig, after: string }[]` 用于分段渲染

**测试要点：**

- 正常解析单个 chart block
- text 中无 chart block 返回纯文本段
- 多个 chart block
- JSON 格式错误时优雅降级（当普通代码块展示）
- type 非法时降级

**Commit:** `feat: implement chart block parser with tests`

---

## Task 4: 实现通用 ChartBlock 渲染组件

**Objective:** 基于 Recharts 实现支持 4 种图表的通用组件

**Files:**

- Create: `src/components/chart/chart-block.tsx`

**组件设计：**

- 接收 `ChartConfig` props
- 根据 `type` 渲染对应 Recharts 组件
- line → `<LineChart>` with `<Line>`
- bar → `<BarChart>` with `<Bar>`
- pie → `<PieChart>` with `<Pie>`
- area → `<AreaChart>` with `<Area>`
- 使用 `<ResponsiveContainer>` 自适应宽度
- 包含 Tooltip、Legend
- 颜色自动分配（预设调色板）
- 暗色主题适配（通过 CSS 变量或 Tailwind）

**Commit:** `feat: implement ChartBlock component with 4 chart types`

---

## Task 5: 集成到消息渲染流程

**Objective:** 在消息渲染中识别 chart block 并渲染图表

**Files:**

- Modify: `src/app/page.tsx` — message parts 渲染逻辑

**改动：**

- 在 `case "text"` 分支中，对 `part.text` 调用 `parseChartBlocks()`
- 如果返回含 chart 段落，分段渲染：文本段用 `<MessageResponse>`，chart 段用 `<ChartBlock>`
- 无 chart 时保持原逻辑不变

**Commit:** `feat: integrate chart rendering into message display`

---

## Task 6: Agent system prompt 增强

**Objective:** 告知 Agent 可以输出图表格式

**Files:**

- Modify: `src/app/api/chat/route.ts` — 在数据源上下文后追加图表格式说明

**追加的 system prompt 片段：**

```
当数据适合可视化时，你可以输出图表。格式为 markdown 代码块：
\`\`\`chart
{
  "type": "line" | "bar" | "pie" | "area",
  "title": "图表标题",
  "data": [{"name": "类别1", "value": 100}, ...],
  "series": ["value", "count"]  // 可选，多系列
}
\`\`\`
规则：
- 数据量少于 3 条时不要出图，用文字即可
- 时序数据优先用 line/area
- 分类对比优先用 bar
- 占比分布优先用 pie
- data 中 name 字段作为 X 轴/分类标签
```

**Commit:** `feat: add chart output instructions to agent system prompt`

---

## Task 7: 集成测试

**Objective:** 端到端验证图表解析 + 渲染

**Files:**

- Create: `src/lib/chart/__tests__/integration.test.ts`

**测试：**

- 模拟 Agent 返回含 chart block 的文本，验证解析正确
- 边界情况：空 data、超多数据点、中文标签

**Commit:** `feat: add chart integration tests`

---

## Task 8: 图表交互增强

**Objective:** 添加下载为图片功能

**Files:**

- Modify: `src/components/chart/chart-block.tsx`

**功能：**

- 鼠标悬浮时显示"下载图片"按钮
- 使用 canvas toDataURL 导出 PNG

**Commit:** `feat: add chart download as image`

---

## 总结

| 任务 | 产出            |
| ---- | --------------- |
| 1    | recharts 依赖   |
| 2    | 类型定义        |
| 3    | 解析器 + 测试   |
| 4    | ChartBlock 组件 |
| 5    | 消息渲染集成    |
| 6    | Agent prompt    |
| 7    | 集成测试        |
| 8    | 下载功能        |

预计产出 ~8 个文件，~500 行代码。
