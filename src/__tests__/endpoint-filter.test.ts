import { describe, it, expect } from "vitest"
import { filterEndpoints } from "@/lib/endpoint-filter"

const endpoints = [
  {
    id: "1",
    name: "获取设备列表",
    path: "/api/devices",
    method: "GET",
    description: "查询所有设备信息",
  },
  { id: "2", name: "创建工单", path: "/api/orders", method: "POST", description: "新建生产工单" },
  {
    id: "3",
    name: "设备状态",
    path: "/api/devices/status",
    method: "GET",
    description: "实时设备运行状态",
  },
  { id: "4", name: "删除工单", path: "/api/orders/{id}", method: "DELETE", description: "" },
]

describe("filterEndpoints", () => {
  it("空关键词返回全部", () => {
    expect(filterEndpoints(endpoints, "")).toEqual(endpoints)
    expect(filterEndpoints(endpoints, "  ")).toEqual(endpoints)
  })

  it("按名称搜索", () => {
    const result = filterEndpoints(endpoints, "设备")
    expect(result).toHaveLength(2)
    expect(result.map((e) => e.id)).toEqual(["1", "3"])
  })

  it("按路径搜索", () => {
    const result = filterEndpoints(endpoints, "orders")
    expect(result).toHaveLength(2)
    expect(result.map((e) => e.id)).toEqual(["2", "4"])
  })

  it("按描述搜索", () => {
    const result = filterEndpoints(endpoints, "实时")
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe("3")
  })

  it("按方法搜索", () => {
    const result = filterEndpoints(endpoints, "DELETE")
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe("4")
  })

  it("搜索不区分大小写", () => {
    const result = filterEndpoints(endpoints, "get")
    expect(result).toHaveLength(2)
  })

  it("无匹配返回空数组", () => {
    expect(filterEndpoints(endpoints, "不存在的内容")).toEqual([])
  })
})

describe("filterEndpoints — undefined fields", () => {
  const sparse = [
    { id: "a", name: "设备查询" },
    { id: "b", path: "/api/items", method: "POST" },
    { id: "c" },
  ]

  it("匹配 name 时忽略缺失的 path/method/description", () => {
    expect(filterEndpoints(sparse, "设备")).toHaveLength(1)
    expect(filterEndpoints(sparse, "设备")[0].id).toBe("a")
  })

  it("匹配 path 时忽略缺失的 name/description", () => {
    expect(filterEndpoints(sparse, "items")).toHaveLength(1)
    expect(filterEndpoints(sparse, "items")[0].id).toBe("b")
  })

  it("全部字段缺失时不报错且不匹配", () => {
    expect(filterEndpoints(sparse, "anything")).toHaveLength(0)
  })

  it("空搜索返回全部（含缺失字段的项）", () => {
    expect(filterEndpoints(sparse, "")).toHaveLength(3)
  })
})
