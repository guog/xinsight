/**
 * 集成测试用 MSW mock server
 * 模拟 ERP 系统的 REST 和 GraphQL 接口
 */
import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"

export const mockRestUrl = "https://mock-erp.test"
export const mockGraphqlUrl = "https://mock-erp.test/api/graphql"

/** 认证检查：Bearer test-token */
function checkAuth(request: Request) {
  const auth = request.headers.get("Authorization")
  if (auth !== "Bearer test-token") {
    return HttpResponse.json({ error: "未授权" }, { status: 401 })
  }
  return null
}

export const handlers = [
  // REST: 获取订单列表
  http.get(`${mockRestUrl}/api/orders`, ({ request }) => {
    const denied = checkAuth(request)
    if (denied) return denied
    return HttpResponse.json({
      orders: [{ id: "O001", product: "钢材", quantity: 100 }],
    })
  }),

  // REST: 获取产品列表
  http.get(`${mockRestUrl}/api/products`, ({ request }) => {
    const denied = checkAuth(request)
    if (denied) return denied
    return HttpResponse.json({
      products: [{ id: "P001", name: "钢材", price: 5000 }],
    })
  }),

  // GraphQL: 统一入口
  http.post(mockGraphqlUrl, async ({ request }) => {
    const denied = checkAuth(request)
    if (denied) return denied

    const body = (await request.json()) as { query?: string }
    if (body.query?.includes("__typename")) {
      return HttpResponse.json({
        data: { __typename: "Query" },
      })
    }
    if (body.query?.includes("orders")) {
      return HttpResponse.json({
        data: { orders: [{ id: "O001", product: "钢材" }] },
      })
    }
    if (body.query?.includes("error")) {
      return HttpResponse.json({
        errors: [{ message: "模拟错误" }],
      })
    }
    return HttpResponse.json({ data: null })
  }),

  // HEAD 请求 — testConnection 用
  http.head(`${mockRestUrl}/*`, ({ request }) => {
    return new HttpResponse(null, { status: 200 })
  }),
  http.head(mockRestUrl, ({ request }) => {
    return new HttpResponse(null, { status: 200 })
  }),
]

export const server = setupServer(...handlers)
