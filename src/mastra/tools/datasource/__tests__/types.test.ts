import { describe, expect, it } from "vitest"
import {
  RestEndpointSchema,
  GraphqlEndpointSchema,
  GrpcEndpointSchema,
  OpcuaEndpointSchema,
  MqttEndpointSchema,
  type RestEndpoint,
  type GraphqlEndpoint,
  type GrpcEndpoint,
  type OpcuaEndpoint,
  type MqttEndpoint,
  type ProtocolEndpoint,
  EndpointSchemaByType,
} from "../types"

/** 公共基础字段 */
const base = {
  id: "ep-1",
  name: "测试端点",
  apiSchemaFormat: "natural" as const,
}

describe("RestEndpointSchema", () => {
  it("解析有效数据", () => {
    const data = {
      ...base,
      method: "GET",
      path: "/users/{id}",
    }
    const result = RestEndpointSchema.parse(data)
    expect(result.method).toBe("GET")
    expect(result.path).toBe("/users/{id}")
  })

  it("支持可选字段", () => {
    const data = {
      ...base,
      method: "POST",
      path: "/users",
      queryParams: { page: "1" },
      requestBody: '{"name": "string"}',
      headers: { "X-Custom": "value" },
      description: "创建用户",
      paramSchema: "some schema",
      responseExample: '{"id": 1}',
    }
    const result = RestEndpointSchema.parse(data)
    expect(result.queryParams).toEqual({ page: "1" })
    expect(result.headers).toEqual({ "X-Custom": "value" })
  })

  it("拒绝无效 method", () => {
    expect(() => RestEndpointSchema.parse({ ...base, method: "INVALID", path: "/x" })).toThrow()
  })

  it("拒绝空 path", () => {
    expect(() => RestEndpointSchema.parse({ ...base, method: "GET", path: "" })).toThrow()
  })
})

describe("GraphqlEndpointSchema", () => {
  it("解析有效数据", () => {
    const data = {
      ...base,
      operationType: "query",
      operationName: "GetUser",
      query: "query GetUser($id: ID!) { user(id: $id) { name } }",
    }
    const result = GraphqlEndpointSchema.parse(data)
    expect(result.operationType).toBe("query")
    expect(result.operationName).toBe("GetUser")
  })

  it("拒绝空 query", () => {
    expect(() =>
      GraphqlEndpointSchema.parse({
        ...base,
        operationType: "query",
        operationName: "X",
        query: "",
      }),
    ).toThrow()
  })

  it("拒绝无效 operationType", () => {
    expect(() =>
      GraphqlEndpointSchema.parse({
        ...base,
        operationType: "invalid",
        operationName: "X",
        query: "{}",
      }),
    ).toThrow()
  })
})

describe("GrpcEndpointSchema", () => {
  it("解析有效数据", () => {
    const data = {
      ...base,
      service: "user.UserService",
      method: "GetUser",
    }
    const result = GrpcEndpointSchema.parse(data)
    expect(result.service).toBe("user.UserService")
    expect(result.method).toBe("GetUser")
  })

  it("支持可选消息定义", () => {
    const result = GrpcEndpointSchema.parse({
      ...base,
      service: "svc",
      method: "m",
      requestMessage: "GetUserRequest",
      responseMessage: "GetUserResponse",
    })
    expect(result.requestMessage).toBe("GetUserRequest")
  })

  it("拒绝空 service", () => {
    expect(() => GrpcEndpointSchema.parse({ ...base, service: "", method: "m" })).toThrow()
  })
})

describe("OpcuaEndpointSchema", () => {
  it("解析有效数据", () => {
    const data = {
      ...base,
      action: "read",
      nodeIds: ["ns=2;s=Temperature"],
    }
    const result = OpcuaEndpointSchema.parse(data)
    expect(result.action).toBe("read")
    expect(result.nodeIds).toEqual(["ns=2;s=Temperature"])
  })

  it("拒绝空 nodeIds 元素", () => {
    expect(() => OpcuaEndpointSchema.parse({ ...base, action: "read", nodeIds: [""] })).toThrow()
  })

  it("拒绝无效 action", () => {
    expect(() => OpcuaEndpointSchema.parse({ ...base, action: "delete", nodeIds: ["x"] })).toThrow()
  })
})

describe("MqttEndpointSchema", () => {
  it("解析有效数据（含默认值）", () => {
    const data = {
      ...base,
      topic: "sensors/temp",
      direction: "subscribe",
    }
    const result = MqttEndpointSchema.parse(data)
    expect(result.topic).toBe("sensors/temp")
    expect(result.qos).toBe(0)
    expect(result.payloadFormat).toBe("json")
  })

  it("支持自定义 qos 和 payloadFormat", () => {
    const result = MqttEndpointSchema.parse({
      ...base,
      topic: "t",
      direction: "publish",
      qos: 2,
      payloadFormat: "binary",
    })
    expect(result.qos).toBe(2)
    expect(result.payloadFormat).toBe("binary")
  })

  it("拒绝 qos > 2", () => {
    expect(() =>
      MqttEndpointSchema.parse({
        ...base,
        topic: "t",
        direction: "publish",
        qos: 3,
      }),
    ).toThrow()
  })

  it("拒绝空 topic", () => {
    expect(() => MqttEndpointSchema.parse({ ...base, topic: "", direction: "publish" })).toThrow()
  })
})

describe("EndpointSchemaByType", () => {
  it("映射正确的 schema", () => {
    expect(EndpointSchemaByType.rest).toBe(RestEndpointSchema)
    expect(EndpointSchemaByType.graphql).toBe(GraphqlEndpointSchema)
    expect(EndpointSchemaByType.grpc).toBe(GrpcEndpointSchema)
    expect(EndpointSchemaByType.opcua).toBe(OpcuaEndpointSchema)
    expect(EndpointSchemaByType.mqtt).toBe(MqttEndpointSchema)
  })
})

describe("ProtocolEndpoint 类型", () => {
  it("联合类型可赋值", () => {
    const rest: ProtocolEndpoint = {
      ...base,
      method: "GET",
      path: "/x",
      apiSchemaFormat: "natural",
    } satisfies RestEndpoint
    expect(rest).toBeDefined()
  })
})
