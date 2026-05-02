# xinsight 知识库 Wiki 方案设计

> 基于 Karpathy LLM Wiki 方法，结合 xinsight 现有架构

## 一、核心设计理念

Karpathy LLM Wiki 的核心不是 RAG，而是**渐进式知识编译**：

- **index.md** = 知识目录（LLM 的"工作记忆入口"）
- **log.md** = 操作日志（时间线，防重复处理）
- **原文不动，知识递进** = raw → 结构化页面 → 索引 → 问答时按需加载

类比"批漏"（Progressive Distillation）：

```
Layer 0: raw/uploads/  (原始 Office/PDF，不可变)
Layer 1: extracted/    (纯文本提取，机械转换)
Layer 2: pages/        (LLM 拆分的结构化页面，含 frontmatter + wikilinks)
Layer 3: index.md      (一行一页的目录摘要 — LLM 每次先读这个)
Layer 4: 问答时按需    (根据 index 定位 → 加载相关页面 → 注入 context → 回答)
```

**关键洞察：LLM 不需要一次性读全部 313K 字符。它只需要先读 index.md（~2K），定位相关页面，再按需读取。**

## 二、目录结构

```
wiki/
├── SCHEMA.md           # 领域规则、标签分类法
├── index.md            # 核心！分类目录 + 一行摘要
├── log.md              # 追加式操作日志
├── raw/
│   └── uploads/        # Layer 0: 原始文件（已有）
├── extracted/          # Layer 1: 纯文本（batch-extract 输出）
├── entities/           # Layer 2: 实体页面（设备、系统、部门）
├── concepts/           # Layer 2: 概念页面（工艺、业务流程）
├── comparisons/        # 对比分析
└── queries/            # 有价值的问答存档
```

## 三、处理管线（与现有代码对应）

### 已有能力（无需重写）

| 步骤     | 现有代码                                  | 作用                |
| -------- | ----------------------------------------- | ------------------- |
| 文件上传 | `file-watcher.ts` / Admin API             | 入口                |
| 验证注册 | `validate.ts`                             | 文件校验 + DB 记录  |
| 文本提取 | `extract-text.ts`                         | Office/PDF → 纯文本 |
| LLM 拆页 | `ingest-pipeline.ts` → `splitIntoPages()` | 文本 → 结构化页面   |

### 需要新增

| 步骤           | 新模块           | 作用                            |
| -------------- | ---------------- | ------------------------------- |
| index 维护     | `wiki-index.ts`  | 每次 ingest 后更新 index.md     |
| 问答检索       | `wiki-search.ts` | 关键词搜索 extracted/ 和 pages/ |
| 知识问答 Agent | `wiki-agent.ts`  | Mastra Agent，使用 wiki tools   |
| wiki tools     | `tools/wiki.ts`  | search / read / list 三个 tool  |

## 四、index.md 的角色（关键设计）

```markdown
# 西安基地智能制造知识库

> 总页面: 42 | 最后更新: 2026-05-02
> 知识领域: WMS仓储、MES生产、物流系统、项目管理

## 实体 (Entities)

- [[wms-system]] WMS仓储管理系统 — 西安基地仓储管理，覆盖入库/出库/盘点/调拨
- [[mes-system]] MES智能生产管理 — 成套/散件产线数字化管控
- [[logistics-system]] 智能物流系统 — AGV、立库、输送线集成
- ...

## 概念 (Concepts)

- [[material-flow]] 物料流转 — 从收货到产线配送的全流程
- [[production-scheduling]] 生产排程 — APS与MES协同
- ...

## 比较 (Comparisons)

- [[wms-v1-vs-v2]] WMS V1与V2对比 — 功能差异与升级路径
```

**Agent 问答时的"批漏"流程：**

1. 先读 `index.md`（~2K chars）→ 知道有什么
2. 根据用户问题，从 index 定位 2-5 个相关页面
3. 读取这些页面（每页 ~3-10K chars）
4. 以页面内容为 context 生成回答
5. 如果回答有价值，存档到 `queries/`

## 五、知识问答 Agent 设计

```typescript
// src/mastra/agents/wiki-agent.ts
export const wikiAgent = new Agent({
  id: "wiki-agent",
  name: "知识库助手",
  instructions: WIKI_QA_INSTRUCTIONS,
  model: "deepseek/deepseek-chat",
  tools: { wikiSearch, wikiRead, wikiList },
})
```

**Agent System Prompt 核心逻辑：**

```
你是西安基地智能制造项目的知识库助手。

回答问题的步骤：
1. 先用 wikiList 获取 index.md 目录
2. 根据问题关键词，用 wikiSearch 搜索相关页面
3. 用 wikiRead 读取最相关的页面（最多5个）
4. 基于页面内容回答，标注来源 [[page-name]]
5. 如果知识库中没有相关信息，明确告知

禁止编造知识库中不存在的信息。
```

**Wiki Tools（Mastra tool 格式）：**

- `wikiList`: 读取 index.md → 返回完整目录
- `wikiSearch(query)`: 在 extracted/ 和 pages/ 中搜索关键词 → 返回匹配文件名+片段
- `wikiRead(page)`: 读取指定页面的完整内容

## 六、实现计划

### Phase 1：结构搭建 + index 生成

1. 创建 `wiki/SCHEMA.md`（定义领域、标签分类法）
2. 对已提取的 6 个 md 文件跑 ingest-pipeline → 生成结构化页面
3. 自动生成 `wiki/index.md`
4. 创建 `wiki/log.md`

### Phase 2：Wiki Tools + Agent

1. 实现 `src/mastra/tools/wiki.ts`（wikiSearch / wikiRead / wikiList）
2. 实现 `src/mastra/agents/wiki-agent.ts`
3. 注册到 agent 选择列表

### Phase 3：端到端验证

1. 通过 chat UI 选择"知识库助手"
2. 提问"WMS系统的入库流程是什么？"
3. 验证 Agent 能正确：读 index → 搜索 → 读页面 → 回答

## 七、与现有架构的集成点

| 现有模块             | 集成方式                                                  |
| -------------------- | --------------------------------------------------------- |
| `ingest-pipeline.ts` | 复用 `splitIntoPages()` + `ingestFile()`，增加 index 更新 |
| `extract-text.ts`    | 无需改动，已支持 docx/pptx/pdf/xlsx                       |
| `prompt.ts`          | wiki-agent 独立 prompt，不影响 WIKI_SYSTEM_PROMPT         |
| `research-agent.ts`  | 可选：增加 wiki tools 让研究助手也能查知识库              |
| DB `wiki_uploads`    | 保持现有状态追踪，ingest 完成后回写 pagesCreated          |

## 八、context 窗口预算

| 层级               | 大小              | 何时加载            |
| ------------------ | ----------------- | ------------------- |
| Agent instructions | ~500 chars        | 每次                |
| index.md           | ~2-3K chars       | 每次问答第一步      |
| 相关页面 (2-5个)   | ~10-30K chars     | 按需                |
| **总计**           | **~15-35K chars** | 远小于 128K context |

相比全量注入 313K，节省约 90% tokens。

## 九、关键设计决策

1. **不用向量数据库** — 关键词搜索 + 结构化 index 足够，维护成本低
2. **index.md 是核心** — 相当于 LLM 的"目录索引"，每次问答必读
3. **页面粒度适中** — 一个概念/实体一个页面（3-10K chars），不过大不过小
4. **log.md 防重复** — 追踪已处理文件，避免重复 ingest
5. **LLM 拆页而非规则拆** — 利用 LLM 理解语义边界，比按字数切块更好
