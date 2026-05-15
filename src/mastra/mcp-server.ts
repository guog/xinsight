import { MCPServer } from "@mastra/mcp"
import { datasourceQueryTool, datasourceListTool } from "./tools/datasource"
import { datasourceBatchQueryTool } from "./tools/cross-source"

/**
 * xinsight MCP Server
 *
 * 将 xinsight 的核心工具暴露为 MCP 协议，
 * 允许 Cursor、Claude Desktop、Windsurf 等 MCP 客户端直接调用。
 *
 * 启动方式：
 *   bun run src/mastra/mcp-server.ts
 *
 * 在 MCP 客户端配置中添加：
 *   {
 *     "mcpServers": {
 *       "xinsight": {
 *         "command": "bun",
 *         "args": ["run", "src/mastra/mcp-server.ts"]
 *       }
 *     }
 *   }
 */
const server = new MCPServer({
  id: "xinsight-mcp",
  name: "xinsight MCP Server",
  version: "1.0.0",
  description: "xinsight 工业智能助手 — 提供数据源查询、跨源批量查询等工具",
  tools: {
    datasourceQueryTool,
    datasourceListTool,
    datasourceBatchQueryTool,
  },
})

// 以 stdio 模式启动（供外部 MCP 客户端连接）
server.startStdio().catch(console.error)
