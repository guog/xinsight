import { describe, test, expect } from "bun:test"
import { formatDatasourceContext, type DatasourceConfig } from "./build-context"

describe("formatDatasourceContext", () => {
  test("返回空字符串当无数据源", () => {
    expect(formatDatasourceContext([])).toBe("")
  })

  test("格式化含 responseSchema 的端点", () => {
    const sources: DatasourceConfig[] = [
      {
        name: "用户服务",
        type: "REST",
        description: "用户相关接口",
        endpoints: [
          {
            name: "获取用户",
            method: "GET",
            path: "/users/:id",
            description: "根据ID获取用户",
            params: [{ name: "id", type: "string" }],
            responseSchema: [
              { name: "name", type: "string", description: "用户名" },
              { name: "age", type: "number" },
            ],
          },
        ],
      },
    ]

    const result = formatDatasourceContext(sources)
    expect(result).toContain("【用户服务】(REST) - 用户相关接口")
    expect(result).toContain("端点: GET /users/:id - 根据ID获取用户")
    expect(result).toContain("参数: id(string)")
    expect(result).toContain("返回: name(string:用户名), age(number)")
  })

  test("格式化无 responseSchema 的端点", () => {
    const sources: DatasourceConfig[] = [
      {
        name: "订单服务",
        type: "GraphQL",
        description: null,
        endpoints: [
          {
            name: "查询订单",
            method: "POST",
            path: "/graphql",
            params: [{ name: "orderId", type: "string" }],
          },
        ],
      },
    ]

    const result = formatDatasourceContext(sources)
    expect(result).toContain("【订单服务】(GraphQL)")
    expect(result).toContain("端点: POST /graphql")
    expect(result).toContain("参数: orderId(string)")
    expect(result).not.toContain("返回:")
  })

  test("超过4000字符时截断", () => {
    const endpoints = Array.from({ length: 100 }, (_, i) => ({
      name: `端点${i}`,
      method: "GET",
      path: `/api/endpoint-${i}/with/long/path/to/make/it/longer`,
      description: `这是一个很长的描述用于测试截断功能第${i}个端点`,
      params: [
        { name: "param1", type: "string" },
        { name: "param2", type: "number" },
      ],
      responseSchema: [
        { name: "field1", type: "string", description: "字段1" },
        { name: "field2", type: "number", description: "字段2" },
      ],
    }))

    const sources: DatasourceConfig[] = [
      { name: "大数据源", type: "REST", description: "测试截断", endpoints },
    ]

    const result = formatDatasourceContext(sources)
    expect(result.length).toBeLessThanOrEqual(4000)
    expect(result).toContain("更多端点省略")
  })
})
