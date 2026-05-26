# XInsight 代码架构优化 Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 优化代码架构使其简洁、人类易懂。消除硬编码模型名、拆分 God Components、清理 dead code、隔离副作用。

**Architecture:** 提取共享常量和配置、拆分大组件为子组件+hooks、将 DB 副作用改为显式初始化。

**Tech Stack:** Bun, TypeScript, Next.js 16, Mastra, AI SDK v6, Drizzle ORM

---

## Task 1: 消除 Agent 硬编码模型名 — 提取默认模型常量

**Objective:** 所有 agent 文件从 `getDefaultModelId()` 获取模型而非硬编码字符串

**Files:**

- Create: `src/mastra/agents/model-config.ts`
- Modify: `src/mastra/agents/factory-director.ts`
- Modify: `src/mastra/agents/production-agent.ts`
- Modify: `src/mastra/agents/quality-agent.ts`
- Modify: `src/mastra/agents/equipment-agent.ts`
- Modify: `src/mastra/agents/warehouse-agent.ts`
- Modify: `src/mastra/agents/energy-agent.ts`
- Modify: `src/mastra/agents/wiki-agent.ts`
- Modify: `src/mastra/agents/auto-agent.ts`
- Modify: `src/mastra/agents/chat-agent.ts`
- Modify: `src/mastra/agents/code-agent.ts`
- Modify: `src/mastra/agents/research-agent.ts`

**Step 1: 创建 model-config.ts**

```typescript
// src/mastra/agents/model-config.ts
import { getDefaultModelId } from "@/lib/models"

/**
 * Agent 默认模型 — 从 DB 动态获取，避免硬编码。
 * 所有 agent 共享此配置，管理员在后台修改即可全局生效。
 */
export const DEFAULT_AGENT_MODEL = getDefaultModelId()
```

**Step 2: 替换所有 agent 文件中的硬编码模型**

每个 agent 文件:

- 添加 `import { DEFAULT_AGENT_MODEL } from "./model-config"`
- 将 `model: "deepseek/deepseek-v4-flash"` 替换为 `model: DEFAULT_AGENT_MODEL`

**Step 3: chat-agent.ts 的 evalModel 也要替换**

```typescript
// Before:
const evalModel = "deepseek/deepseek-v4-flash"
// After:
import { DEFAULT_AGENT_MODEL } from "./model-config"
const evalModel = DEFAULT_AGENT_MODEL
```

**Step 4: 修复 use-model.ts 的 fallback**

```typescript
// Before:
const FALLBACK_MODEL = "deepseek/deepseek-v4-flash"
// After:
const FALLBACK_MODEL = "" // 空字符串，实际值由 getDefaultModelId() 在服务端提供
```

不对，use-model.ts 是客户端 hook，不能调用服务端函数。保持 fallback 但改从 API 获取：实际上 `getDefaultModelId` 已经在 `models.ts` 有了，use-model.ts 的 fallback 只是 SSR 占位。保持不变，但注释说明。

**Step 5: 修复 wiki LLM 配置**

`src/lib/wiki/ingest-pipeline.ts` 和 `src/lib/wiki/auto-fix.ts`:

- 提取共享 LLM provider 到 `src/lib/wiki/llm.ts`
- 用 `getDefaultModelId()` 的 modelSlug 部分

**Step 6: 验证**

```bash
bunx tsc --noEmit
```

**Step 7: Commit**

```bash
git add -A
git commit -m "refactor: extract default model config, remove hardcoded model names"
```

---

## Task 2: 删除废弃的 agents barrel + dead imports

**Objective:** 清理 dead code

**Files:**

- Delete: `src/mastra/agents/index.ts`
- Modify: `src/components/agent-message.tsx` — 删除未使用的 `Route`, `useMemo` imports, `isDone` 变量

**Step 1: 确认 barrel 无引用后删除**

```bash
# 确认没有文件引用 agents/index barrel（之前验证过）
rm src/mastra/agents/index.ts
```

**Step 2: 清理 agent-message.tsx dead imports**

- 删除 `Route` from lucide-react import
- 删除 `useMemo` from react import
- 删除 `isDone` 未使用变量

**Step 3: 验证**

```bash
bunx tsc --noEmit
```

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor: remove dead agents barrel and unused imports"
```

---

## Task 3: 提取 AGENT_MAP 配置到独立文件

**Objective:** 将 agent-message.tsx 中 ~100 行硬编码配置移到独立文件

**Files:**

- Create: `src/config/agent-registry.ts`
- Modify: `src/components/agent-message.tsx`

**Step 1: 创建 agent-registry.ts**

将 `AGENT_MAP` 和 `TOOL_AGENT_MAP` 移到 `src/config/agent-registry.ts` 并导出。

**Step 2: agent-message.tsx 改为 import**

```typescript
import { AGENT_MAP, TOOL_AGENT_MAP } from "@/config/agent-registry"
```

**Step 3: 验证 + Commit**

---

## Task 4: 拆分 page.tsx — 提取消息渲染组件

**Objective:** 将 page.tsx 的 message parts 渲染逻辑提取为独立组件

**Files:**

- Create: `src/components/chat/message-part-renderer.tsx`
- Modify: `src/app/page.tsx`

**Step 1: 提取 MessagePartRenderer**

将 page.tsx 中 `message.parts.map` 的 switch-case（约 70 行）提取为 `<MessagePartRenderer part={part} />` 组件。

**Step 2: 提取 apiBase 常量**

```typescript
// src/lib/api.ts
export const API_BASE = process.env.NEXT_PUBLIC_API_URL || ""
```

page.tsx 和 mobile-chat-page.tsx 都使用此常量。

**Step 3: 验证 + Commit**

---

## Task 5: 拆分 sidebar.tsx — 提取 ChatListItem + useChatList hook

**Objective:** 将 sidebar 从 331 行 God Component 拆为子组件 + hook

**Files:**

- Create: `src/hooks/use-chat-list.ts` — 封装列表 CRUD + 搜索
- Create: `src/components/chat/chat-list-item.tsx` — 单个对话项
- Modify: `src/components/sidebar.tsx` — 精简为布局组件

**Step 1-3: 逐步提取和验证**

---

## Task 6: 隔离 DB 副作用

**Objective:** db/index.ts 只导出 db 实例，副作用移到显式初始化

**Files:**

- Create: `src/db/init.ts`
- Modify: `src/db/index.ts`
- Modify: `src/instrumentation.ts`（或 app 入口调用 init）

**Step 1: 创建 init.ts**

```typescript
// src/db/init.ts
import { db } from "./index"
import { migrate } from "drizzle-orm/bun-sqlite/migrator"
import { seedUsers } from "./seed"
import { seedProvidersFromEnv } from "@/lib/provider-seed"

export async function initDatabase() {
  try {
    migrate(db, { migrationsFolder: "./drizzle" })
  } catch (e) {
    console.warn("Migration skipped:", (e as Error).message)
  }
  await seedUsers().catch((e) => console.warn("Seed users failed:", (e as Error).message))
  await seedProvidersFromEnv().catch((e) => console.error("Provider seed failed:", e))
}
```

**Step 2: db/index.ts 只保留 db 创建**
**Step 3: instrumentation.ts 调用 initDatabase()**
**Step 4: 验证 + Commit**

---

## Task 7: API route 职责拆分

**Objective:** chat/route.ts 的持久化逻辑移到 repository

**Files:**

- Create: `src/db/repositories/chat-repo.ts`（如果不存在）
- Modify: `src/app/api/chat/route.ts`

---

## Task 8: 文件归组 + 清理

**Objective:** 整理目录结构

**Steps:**

- 删除 `src/app/(desktop)/` 空目录
- lib/ 下 provider-presets.ts、provider-seed.ts、provider-sync.ts 移到 `src/lib/provider/`
- 清理 .DS_Store
- 更新所有 import 路径

---

## Task 9: Wiki LLM 提取共享配置

**Objective:** wiki 的 auto-fix.ts 和 ingest-pipeline.ts 共享 LLM provider

**Files:**

- Create: `src/lib/wiki/llm.ts`
- Modify: `src/lib/wiki/auto-fix.ts`
- Modify: `src/lib/wiki/ingest-pipeline.ts`

---

## Task 10: 验证 + PR

**Steps:**

1. `bunx tsc --noEmit`
2. `bun test`
3. 启动 dev server 验证功能
4. Code review
5. 创建 PR
