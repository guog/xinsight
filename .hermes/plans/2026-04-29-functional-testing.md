# 数据源适配器功能测试 Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 为数据源适配器系统编写方案 A（vitest mock server 集成测试）+ 方案 B（Playwright E2E 冒烟测试），覆盖 API CRUD、适配器查询、Admin UI 全流程。

**Architecture:**

- 方案 A：vitest + mock HTTP server（模拟第三方 REST/GraphQL 服务），测试 API routes + adapter 集成链路
- 方案 B：Playwright 启动 dev server，E2E 验证 Admin 管理后台 UI 操作流程

**Tech Stack:** vitest, @vitest/coverage-v8, msw (Mock Service Worker) or http.createServer, playwright, bun

---

## 方案 A：集成测试（Mock Server）

### Task 1: 安装集成测试依赖

**Objective:** 安装 msw（Mock Service Worker）用于拦截 HTTP 请求模拟第三方 API

**Step 1: 安装**

```bash
bun add -D msw
```

**Step 2: Commit**

```bash
git add package.json bun.lock
git commit -m "chore: 添加 msw 集成测试依赖"
```

---

### Task 2: 创建 Mock Server 和测试工具

**Objective:** 搭建 msw handler 模拟 REST 和 GraphQL 第三方服务响应

**Files:**

- Create: `src/__tests__/integration/helpers/mock-server.ts`
- Create: `src/__tests__/integration/helpers/test-db.ts`

**Step 1: 创建 mock server helpers**

`mock-server.ts` — 用 msw 的 `setupServer()` 创建 mock handlers：

- `GET https://mock-erp.test/api/orders` → 返回模拟订单数据
- `POST https://mock-erp.test/api/graphql` → 返回模拟 GraphQL 响应
- 支持 Bearer token 认证校验（无 token 返回 401）

`test-db.ts` — 创建临时 SQLite DB（`:memory:`）+ 初始化 schema + 返回 repo 实例。每个测试用独立内存 DB 避免互相影响。

**Step 2: Commit**

```bash
git add src/__tests__/integration/
git commit -m "test: 添加集成测试 mock server 和 test-db 工具"
```

---

### Task 3: REST 适配器集成测试

**Objective:** 测试 REST adapter 通过 mock server 完整抓取数据流程

**Files:**

- Create: `src/__tests__/integration/adapters/rest-adapter.integration.test.ts`

**测试用例：**

1. ✅ 成功查询 — 创建数据源 → 通过 adapter.query() 查询 → 验证返回 mock 数据
2. ✅ 认证失败 — 数据源无 auth 配置 → adapter 返回 401 错误
3. ✅ testConnection 成功 — mock server 可达 → 返回 `{ success: true }`
4. ✅ testConnection 失败 — mock server 不可达 → 返回 `{ success: false }`
5. ✅ 带查询参数 — query 传入 params → 验证 URL 拼接正确

**Step: Commit**

```bash
git commit -m "test: REST 适配器集成测试"
```

---

### Task 4: GraphQL 适配器集成测试

**Objective:** 测试 GraphQL adapter 通过 mock server 完整查询流程

**Files:**

- Create: `src/__tests__/integration/adapters/graphql-adapter.integration.test.ts`

**测试用例：**

1. ✅ 成功查询 — 发送 GraphQL query + variables → 返回正确 data
2. ✅ GraphQL 错误 — mock 返回 `{ errors: [...] }` → adapter 正确处理
3. ✅ testConnection 成功/失败

**Step: Commit**

```bash
git commit -m "test: GraphQL 适配器集成测试"
```

---

### Task 5: API Routes 集成测试

**Objective:** 测试 `/api/datasources` 全部 CRUD 路由的集成链路

**Files:**

- Create: `src/__tests__/integration/api/datasources-api.integration.test.ts`

**测试用例（使用 test-db helper 注入内存 DB）：**

1. `POST /api/datasources` — 创建 REST 类型数据源 → 201 + 返回完整对象
2. `GET /api/datasources` — 返回数据源列表
3. `GET /api/datasources/[id]` — 返回单个数据源
4. `PUT /api/datasources/[id]` — 更新数据源名称 → 验证变更
5. `DELETE /api/datasources/[id]` — 删除 → 再 GET 返回 404
6. `POST /api/datasources/[id]/test` — 测试连接（mock server 在线时成功）
7. `POST /api/datasources/[id]/agents` — 关联 agent
8. 错误路径：创建无效数据 → 400 / 查询不存在 ID → 404

**注意：** Next.js API routes 不能直接 import 调用，需要用 `fetch` 访问运行中的 dev server 或者用 next 的 test helpers。推荐方式：直接测试 handler 函数，mock `NextResponse` 和 `Request`。

**Step: Commit**

```bash
git commit -m "test: API routes 集成测试"
```

---

### Task 6: Mastra Tool 集成测试

**Objective:** 测试 datasource-list 和 datasource-query tool 完整链路

**Files:**

- Create: `src/__tests__/integration/tools/datasource-tools.integration.test.ts`

**测试用例：**

1. `datasource-list` tool — DB 有 2 个数据源 → 返回列表
2. `datasource-query` tool — 传入数据源 ID + endpoint → 通过 mock server 返回数据
3. `datasource-query` tool — 数据源 disabled → 返回错误
4. `datasource-query` tool — 数据源不存在 → 返回错误

**Step: Commit**

```bash
git commit -m "test: Mastra tool 集成测试"
```

---

## 方案 B：Playwright E2E 冒烟测试

### Task 7: 安装 Playwright

**Objective:** 安装 Playwright 和浏览器

**Step 1: 安装**

```bash
bun add -D @playwright/test
bunx playwright install chromium
```

**Step 2: 创建 playwright.config.ts**

```typescript
import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  webServer: {
    command: "bun run dev",
    port: 3000,
    reuseExistingServer: true,
    timeout: 60_000,
  },
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
  },
})
```

**Step 3: 添加 scripts**
在 package.json 添加：

```json
"test:e2e": "bunx playwright test"
```

**Step 4: Commit**

```bash
git commit -m "chore: 添加 Playwright E2E 测试基础设施"
```

---

### Task 8: Admin 数据源管理 E2E 测试

**Objective:** E2E 验证 Admin 后台数据源 CRUD 全流程

**Files:**

- Create: `e2e/admin-datasources.spec.ts`

**测试流程（单个 test 串行执行）：**

1. 打开 `/admin/datasources` → 页面加载成功，显示标题
2. 点击"新增数据源" → 打开表单
3. 填写表单（名称：E2E测试源，类型：REST，URL：https://httpbin.org/get）→ 提交 → 列表出现新数据源
4. 点击数据源 → 进入详情/编辑页
5. 修改名称 → 保存 → 验证列表更新
6. 点击"测试连接" → 显示结果（httpbin.org 应成功）
7. 删除数据源 → 确认 → 列表中消失

**Step: Commit**

```bash
git commit -m "test: Admin 数据源管理 E2E 冒烟测试"
```

---

### Task 9: Agent 数据查询 E2E 测试（可选）

**Objective:** E2E 验证 Agent 通过 chat 界面调用数据源查询

**Files:**

- Create: `e2e/agent-datasource-query.spec.ts`

**测试流程：**

1. 先通过 API 创建一个测试数据源（httpbin.org）
2. 打开 chat 界面
3. 输入"查询 E2E测试源 的数据"
4. 等待 Agent 响应 → 验证返回了 httpbin 的数据

**决策：** 标记为 `test.skip`，依赖 LLM 调用不确定性大，不阻塞 CI。

**Step: Commit**

```bash
git commit -m "test: Agent 数据查询 E2E 测试（可选）"
```

---

### Task 10: 运行全部测试 + 最终提交

**Objective:** 确保所有测试通过，创建 PR

**Steps:**

```bash
# 单元测试
bun run test

# 集成测试
bun run test -- --dir src/__tests__/integration

# E2E 测试
bun run test:e2e

# 全部通过后
git checkout -b feat/functional-testing
git push origin feat/functional-testing
gh pr create --title "test: 数据源适配器功能测试（集成 + E2E）" --body "..."
```

---

## 总结

| 方案       | 范围                        | 工具                   | CI 可跑        |
| ---------- | --------------------------- | ---------------------- | -------------- |
| A 集成测试 | API routes, adapters, tools | vitest + msw + 内存 DB | ✅             |
| B E2E 测试 | Admin UI 全流程             | Playwright + chromium  | ✅（需浏览器） |

共约 **20+ 测试用例**，覆盖从数据库→适配器→API→UI 的全链路。
