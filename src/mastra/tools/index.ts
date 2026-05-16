/**
 * Mastra 工具注册表
 *
 * 在此文件导出所有自定义工具，供 Agent 使用。
 * 注意：datasourceQueryTool / datasourceListTool 已由动态工具（buildDynamicTools）替代，
 * Agent 不再静态注册这两个工具。MCP Server 仍单独引用它们。
 */

export { datasourceQueryTool, datasourceListTool } from "./datasource"
export { datasourceBatchQueryTool } from "./cross-source"
export { wikiSearchTool, wikiReadTool, wikiIngestTool, wikiListTool } from "./wiki"
