/**
 * @xinsight/mes-demo
 *
 * MES 制造执行系统演示包
 * 提供"厂长"Agent + 25 个 MES 查询工具 + 完整 mock 数据
 *
 * 集成方式：在 Mastra 注册时展开 mesDemoAgents 即可
 */
export { factoryDirectorAgent } from "./agents"
export { mesTools } from "./tools"
export { mesDemoAgents } from "./agents/registry"
