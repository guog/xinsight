import { Mastra } from "@mastra/core"
import { createLogger } from "@mastra/core/logger"
import { MastraEditor } from "@mastra/editor"
import { Memory } from "@mastra/memory"
import { LibSQLStore, LibSQLVector } from "@mastra/libsql"
import { fastembed } from "@mastra/fastembed"
import { Observability, MastraStorageExporter } from "@mastra/observability"
import { join } from "path"

import { factoryDirectorAgent } from "./agents/factory-director"
import { productionAgent } from "./agents/production-agent"
import { qualityAgent } from "./agents/quality-agent"
import { equipmentAgent } from "./agents/equipment-agent"
import { warehouseAgent } from "./agents/warehouse-agent"
import { energyAgent } from "./agents/energy-agent"
import { wikiAgent } from "./agents/wiki-agent"
import { chatAgent } from "./agents/chat-agent"
import { autoAgent } from "./agents/auto-agent"
import { researchAgent } from "./agents/research-agent"

/**
 * Mastra 实例 — 注册所有 Agent
 *
 * 架构：Supervisor + 域子 Agent
 * - factoryDirectorAgent: 厂长（Supervisor），统筹协调所有子 Agent
 * - productionAgent: 生产管理专员（base + production + traceability）
 * - qualityAgent: 质量管理专员（base + quality + traceability）
 * - equipmentAgent: 设备管理专员（base + equipment）
 * - warehouseAgent: 仓储物流专员（base + warehouse）
 * - energyAgent: 能源管理专员（base + energy）
 * - wikiAgent: 知识库专员（wiki 工具）
 */

// ─── 数据库路径（本地 SQLite） ───
const dataDir = join(process.cwd(), "data")
const memoryDbUrl = process.env.MEMORY_DB_URL || `file:${join(dataDir, "memory.db")}`
const storageDbUrl = process.env.STORAGE_DB_URL || `file:${join(dataDir, "storage.db")}`

// ─── 全局 Storage — 用于 traces、workflow 快照、后台任务等 ───
const storage = new LibSQLStore({
  id: "xinsight-storage",
  url: storageDbUrl,
})

// ─── Memory — 消息历史 + 观察性记忆 + Working Memory + 语义召回 ───
const memory = new Memory({
  storage: new LibSQLStore({
    id: "xinsight-memory",
    url: memoryDbUrl,
  }),
  // 语义召回：LibSQLVector + 本地嵌入模型（FastEmbed，无需 API key）
  vector: new LibSQLVector({
    id: "xinsight-vector",
    url: memoryDbUrl,
  }),
  embedder: fastembed,
  options: {
    lastMessages: parseInt(process.env.MASTRA_LAST_MESSAGES || "20", 10),
    // 观察性记忆：Agent 自动从对话中提取用户相关信息
    observationalMemory: true,
    // 语义召回：超出消息窗口后，用向量搜索找回相关历史
    semanticRecall: {
      topK: 5,
      messageRange: 3,
    },
    // Working Memory：跨会话持久化用户画像和偏好
    workingMemory: {
      enabled: true,
      scope: "resource",
      template: `# 用户画像
- **姓名**:
- **角色**:
- **部门**:
- **关注领域**:
- **偏好设置**:
- **常用数据源**:
- **沟通风格**:
`,
    },
  },
})

export const mastra = new Mastra({
  logger: createLogger({ name: "xinsight", level: "info" }),
  storage,
  memory: { default: memory },
  agents: {
    chatAgent,
    factoryDirectorAgent,
    productionAgent,
    qualityAgent,
    equipmentAgent,
    warehouseAgent,
    energyAgent,
    wikiAgent,
    autoAgent,
    researchAgent,
  },
  editor: new MastraEditor(),
  // ─── 可观测性 — 本地 tracing，数据存储到 Storage DB ───
  observability: new Observability({
    configs: {
      default: {
        serviceName: "xinsight",
        exporters: [new MastraStorageExporter()],
      },
    },
  }),
})
