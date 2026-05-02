# 知识库摄入管线设计

## 1. 概述

知识库基于 Karpathy LLM Wiki 原理：将源文档转换为结构化 Markdown 页面，通过关键词搜索 + 原文注入 LLM context window，不使用向量数据库或 embedding。

本设计关注**源文件发现 → 验证 → 摄入**的完整生命周期管理。

---

## 2. 核心概念

| 概念                  | 说明                                                    |
| --------------------- | ------------------------------------------------------- |
| 源文件（Raw File）    | 用户上传或手动放入 `raw/uploads/` 的原始文档            |
| 提取文本（Extracted） | 从源文件中解析出的纯文本/Markdown 中间产物              |
| Wiki 页面（Page）     | LLM 将提取文本拆分、整理后生成的结构化知识页面          |
| 摄入（Ingest）        | 源文件 → 提取文本 → LLM 拆分 → 写入 wiki 页面的完整过程 |

---

## 3. 文件发现机制（三入口统一管道）

### 3.1 入口

| 入口         | 触发时机                                | 说明                         |
| ------------ | --------------------------------------- | ---------------------------- |
| UI 上传      | 用户通过 `POST /api/wiki/upload` 上传   | 已有路径                     |
| 文件系统监听 | `fs.watch("raw/uploads/")` 检测到新文件 | 实时发现手动 copy 的文件     |
| 启动扫描     | 程序启动时一次性扫描                    | 兜底，覆盖停机期间放入的文件 |

### 3.2 统一验证管道

三个入口发现文件后，统一进入 `validateAndRegister()` 函数：

```
发现文件
  → 文件类型校验（扩展名 + MIME）
  → 文件大小校验（≤ 10MB）
  → SHA256 去重（与 registry 已有记录比对）
  → 文本提取（extractText）
  → 注册到 registry（含摄入状态）
  → 根据 autoIngest 设置决定后续动作
```

验证失败的文件：

- 在 registry 中标记为 `invalid`
- 记录失败原因（`invalidReason` 字段）
- 在管理界面显示，供管理员处理（删除或覆盖类型白名单）

### 3.3 文件监听细节

```typescript
// src/lib/wiki/file-watcher.ts
import { watch } from "fs"

// 监听 raw/uploads/ 目录
// - 使用 debounce（500ms）避免写入过程中重复触发
// - 忽略 .registry.json 和 .extracted.md 文件
// - 忽略临时文件（.tmp, .crdownload, .part 等）
// - 新文件稳定后（文件大小不再变化）再进入验证管道
```

文件稳定性检测：检测到新文件后，间隔 1s 检查两次 `stat.size`，相同则认为写入完成。

---

## 4. 摄入状态模型

### 4.1 数据库表：`wiki_uploads`

替代当前基于 JSON 文件的 `upload-registry`，改为 DB 持久化：

```sql
CREATE TABLE wiki_uploads (
  id            TEXT PRIMARY KEY,
  original_name TEXT NOT NULL,          -- 原始文件名
  stored_path   TEXT NOT NULL UNIQUE,   -- raw/uploads/ 下的相对路径
  mime_type     TEXT NOT NULL,
  size          INTEGER NOT NULL,       -- 字节
  sha256        TEXT NOT NULL UNIQUE,   -- 内容哈希，去重用

  -- 摄入状态
  status        TEXT NOT NULL DEFAULT 'pending',
    -- pending:  已注册，待摄入
    -- ingesting: 摄入中
    -- completed: 摄入完成
    -- failed:   摄入失败
    -- invalid:  验证不通过

  ingest_task_id  TEXT,                 -- 关联的 TaskRunner 任务 ID
  ingest_progress INTEGER DEFAULT 0,   -- 进度百分比 0-100
  ingest_error    TEXT,                 -- 失败原因
  invalid_reason  TEXT,                 -- 验证失败原因
  pages_created   TEXT,                 -- JSON array: 生成的 wiki 页面路径列表

  -- 发现来源
  source        TEXT NOT NULL DEFAULT 'upload',
    -- upload:  UI 上传
    -- watch:   文件监听发现
    -- scan:    启动扫描发现

  uploaded_at   INTEGER NOT NULL,       -- timestamp
  ingested_at   INTEGER,                -- 摄入完成时间
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);
```

### 4.2 状态流转

```
                    ┌─────────────────┐
                    │   文件发现      │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │   验证管道      │
                    └───┬─────────┬───┘
                        │         │
                  验证通过      验证失败
                        │         │
               ┌────────▼───┐ ┌───▼────────┐
               │  pending   │ │  invalid   │
               └────┬───────┘ └────────────┘
                    │
          autoIngest=true      手动触发
          或手动触发            │
                    │◄─────────┘
               ┌────▼───────┐
               │ ingesting  │
               └────┬───┬───┘
                    │   │
              成功  │   │  失败
                    │   │
          ┌────────▼┐ ┌▼─────────┐
          │completed│ │  failed  │
          └─────────┘ └──────────┘
                           │
                      手动重试
                           │
                    ┌──────▼──────┐
                    │  ingesting  │
                    └─────────────┘
```

---

## 5. 系统设置：autoIngest

### 5.1 存储

新增 `wiki_settings` 表（或复用通用 settings 表）：

```sql
CREATE TABLE wiki_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- 默认值
INSERT INTO wiki_settings (key, value) VALUES ('auto_ingest', 'true');
```

### 5.2 行为

| autoIngest | 上传/发现文件后                             | 管理界面              |
| ---------- | ------------------------------------------- | --------------------- |
| `true`     | 验证通过 → 立即创建摄入任务                 | 显示进度，可暂停/取消 |
| `false`    | 验证通过 → 状态设为 `pending`，等待手动触发 | 显示「摄入」按钮      |

### 5.3 设置 API

```
GET  /api/wiki/admin/settings          → { auto_ingest: boolean }
PUT  /api/wiki/admin/settings          → { auto_ingest: boolean }
```

---

## 6. API 设计

### 6.1 源文件管理

| 端点                                    | 方法   | 说明                             |
| --------------------------------------- | ------ | -------------------------------- |
| `/api/wiki/upload`                      | POST   | 上传文件（已有，需改造）         |
| `/api/wiki/admin/uploads`               | GET    | 列表所有源文件（含摄入状态）     |
| `/api/wiki/admin/uploads/[id]`          | DELETE | 删除源文件及其生成的 wiki 页面   |
| `/api/wiki/admin/uploads/[id]/ingest`   | POST   | 手动触发摄入                     |
| `/api/wiki/admin/uploads/[id]/reingest` | POST   | 重新摄入（删除旧页面后重新生成） |

### 6.2 列表响应格式

```json
{
  "uploads": [
    {
      "id": "uuid",
      "originalName": "WMS仓储管理系统蓝图设计报告V2.docx",
      "storedPath": "raw/uploads/1714600000-a1b2c3d4.docx",
      "mimeType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "size": 2048576,
      "sha256": "abc123...",
      "status": "completed",
      "ingestProgress": 100,
      "pagesCreated": ["entities/wms-overview.md", "concepts/warehouse-zones.md"],
      "source": "watch",
      "uploadedAt": "2026-05-02T03:20:00Z",
      "ingestedAt": "2026-05-02T03:21:30Z"
    }
  ]
}
```

---

## 7. 前端管理界面

### 7.1 上传管理 Tab 改造

当前的 `uploads-tab.tsx` 改为以 **源文件为中心** 展示：

| 列       | 内容                                          |
| -------- | --------------------------------------------- |
| 文件名   | 原始文件名                                    |
| 大小     | 格式化显示                                    |
| 来源     | 图标标识：上传 / 监听发现 / 启动扫描          |
| 状态     | 带颜色的状态标签 + 进度条（ingesting 时显示） |
| 生成页面 | 数量 + 可展开查看列表                         |
| 上传时间 |                                               |
| 操作     | 摄入 / 重新摄入 / 删除（根据状态动态显示）    |

### 7.2 状态标签颜色

| 状态      | 颜色          | 文案                     |
| --------- | ------------- | ------------------------ |
| pending   | 黄色          | 待摄入                   |
| ingesting | 蓝色 + 进度条 | 摄入中 32%               |
| completed | 绿色          | 已完成                   |
| failed    | 红色          | 失败（hover 显示原因）   |
| invalid   | 灰色          | 不合规（hover 显示原因） |

### 7.3 设置区域

页面顶部增加设置栏：

```
[✓] 自动摄入  — 新文件发现后自动触发知识提取
[全部摄入] — 一键摄入所有 pending 状态的文件
```

---

## 8. 摄入进度实时推送

复用现有 TaskRunner + SSE 机制：

1. 创建摄入任务时，将 `taskId` 写入 `wiki_uploads.ingest_task_id`
2. 前端通过 `GET /api/wiki/admin/tasks/[id]/stream` 订阅 SSE
3. TaskRunner 的 `reportProgress` 回调同时更新 `wiki_uploads.ingest_progress`
4. 任务完成/失败时更新 `wiki_uploads.status`

前端轮询 + SSE 结合：

- 列表页：每 5s 轮询刷新状态
- 有 ingesting 状态的行：自动建立 SSE 连接获取实时进度

---

## 9. 摄入管道改造

### 9.1 当前流程

```
upload route → extractText() → writeFile(.extracted.md) → ingestFile() → LLM 拆分 → 写入 wiki/
```

### 9.2 改造后流程

```
validateAndRegister()
  → extractText() → 保存 .extracted.md
  → 更新 DB 记录（status=pending, 或直接 ingesting）

triggerIngest(uploadId)
  → 读取 .extracted.md
  → 更新 status=ingesting
  → TaskRunner.createTask("ingest", executor)
    → LLM splitIntoPages()
    → 逐页写入 wiki/
    → 更新 progress
  → 成功: status=completed, pages_created=[...]
  → 失败: status=failed, ingest_error="..."
```

### 9.3 upload route 改造

```typescript
// POST /api/wiki/upload
// 改造点：
// 1. 调用 validateAndRegister() 统一验证
// 2. 写入 DB 而非 JSON registry
// 3. 根据 autoIngest 设置决定是否触发
```

---

## 10. 模块划分

```
src/lib/wiki/
├── types.ts              // 类型定义（改造）
├── extract-text.ts       // 文本提取（不变）
├── validate.ts           // 新增：统一验证管道
├── file-watcher.ts       // 新增：文件系统监听
├── startup-scan.ts       // 新增：启动扫描
├── ingest-pipeline.ts    // 摄入管线（改造）
├── task-runner.ts        // 任务运行器（不变）
├── upload-registry.ts    // 废弃，迁移到 DB
├── lint.ts               // 不变
├── auto-fix.ts           // 不变
└── prompt.ts             // 不变

src/db/schema.ts          // 新增 wiki_uploads, wiki_settings 表
```

---

## 11. 启动集成

在 Next.js 应用启动时（`instrumentation.ts` 或自定义初始化模块）：

```typescript
// src/lib/wiki/init.ts
export async function initWikiSystem() {
  // 1. 启动文件监听
  startFileWatcher()

  // 2. 执行启动扫描
  await startupScan()
}
```

注意：Next.js dev 模式下 HMR 会多次执行，需要防重入（用全局标志位或单例模式）。

---

## 12. 迁移策略

### 从 JSON registry 迁移到 DB

1. 读取现有 `raw/uploads/.registry.json`
2. 将记录导入 `wiki_uploads` 表
3. 扫描 `raw/uploads/` 目录补全缺失记录
4. 删除 `.registry.json`

---

## 13. 边界情况

| 场景                          | 处理方式                                                      |
| ----------------------------- | ------------------------------------------------------------- |
| 大文件写入中被监听检测到      | 稳定性检测（1s 间隔检查 size 不变）                           |
| 同一文件连续上传两次          | SHA256 去重，返回 409                                         |
| 摄入过程中程序崩溃            | 重启扫描发现 status=ingesting 的记录，重置为 pending 重新摄入 |
| LLM API 调用失败              | status=failed，记录错误，可手动重试                           |
| 超大文件（>10MB）             | 标记 invalid，reason="文件大小超过限制"                       |
| 不支持的文件类型              | 标记 invalid，reason="不支持的文件类型: .xxx"                 |
| wiki/ 目录下页面被手动删除    | 不影响 upload 记录，reingest 可重新生成                       |
| autoIngest 从 false 改为 true | 不追溯处理已有 pending 文件（需手动点「全部摄入」）           |
