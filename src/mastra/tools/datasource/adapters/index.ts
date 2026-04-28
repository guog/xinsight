import type { DatasourceAdapter } from "../types"
import { RestAdapter } from "./rest-adapter"
import { GraphqlAdapter } from "./graphql-adapter"
import { OpcuaAdapter } from "./opcua-adapter"
import { MqttAdapter } from "./mqtt-adapter"
import { GrpcAdapter } from "./grpc-adapter"

/** 适配器注册表 */
const adapters = new Map<string, DatasourceAdapter>()

/** 注册适配器 */
export function registerAdapter(adapter: DatasourceAdapter): void {
  adapters.set(adapter.type, adapter)
}

/** 获取适配器 */
export function getAdapter(type: string): DatasourceAdapter | undefined {
  return adapters.get(type)
}

// 注册内置适配器
registerAdapter(new RestAdapter())
registerAdapter(new GraphqlAdapter())
registerAdapter(new GrpcAdapter())
registerAdapter(new MqttAdapter())
