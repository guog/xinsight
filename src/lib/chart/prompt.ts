// 图表输出格式的 system prompt 指令

export const CHART_SYSTEM_PROMPT = `
当数据适合可视化时，你可以输出图表。格式为 markdown 代码块：
\`\`\`chart
{
  "type": "line" | "bar" | "pie" | "area",
  "title": "图表标题",
  "data": [{"name": "类别1", "value": 100}, {"name": "类别2", "value": 200}],
  "series": ["value"]
}
\`\`\`
图表规则：
- 数据量少于 3 条时不要出图，用文字即可
- 时序数据优先用 line 或 area
- 分类对比优先用 bar
- 占比分布优先用 pie
- data 中 name 字段作为 X 轴/分类标签，其他数值字段作为系列
- series 可选，指定要展示的数值字段列表
`
