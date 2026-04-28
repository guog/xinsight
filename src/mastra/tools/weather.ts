import { createTool } from "@mastra/core/tools"
import { z } from "zod"

/**
 * 天气查询工具 — 示例工具，演示 Mastra Tool 系统
 *
 * 使用 Open-Meteo 免费 API，无需 API Key
 */
export const weatherTool = createTool({
  id: "weather",
  description: "查询指定城市的当前天气信息",
  inputSchema: z.object({
    city: z.string().describe("城市名称（英文）"),
  }),
  outputSchema: z.object({
    temperature: z.number().describe("当前温度（摄氏度）"),
    description: z.string().describe("天气描述"),
  }),
  execute: async (inputData) => {
    // 先通过城市名获取经纬度
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(inputData.city)}&count=1`,
    )
    const geoData = await geoRes.json()
    if (!geoData.results?.length) {
      return { temperature: 0, description: "未找到该城市" }
    }

    const { latitude, longitude } = geoData.results[0]

    // 获取天气
    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`,
    )
    const weatherData = await weatherRes.json()
    const current = weatherData.current_weather

    const weatherCodes: Record<number, string> = {
      0: "晴天",
      1: "大部晴朗",
      2: "多云",
      3: "阴天",
      45: "雾",
      48: "霜雾",
      51: "小毛毛雨",
      61: "小雨",
      63: "中雨",
      65: "大雨",
      71: "小雪",
      73: "中雪",
      75: "大雪",
      95: "雷暴",
    }

    return {
      temperature: current.temperature,
      description: weatherCodes[current.weathercode] ?? `天气代码 ${current.weathercode}`,
    }
  },
})
