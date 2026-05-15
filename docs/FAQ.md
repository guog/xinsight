# 常见问题（FAQ）

## `bun dev` 首次启动极慢，CPU 100%，卡在 "Compiling / ..."

### 症状

运行 `bun dev` 后 Turbopack 长时间卡在 `Compiling / ...`，CPU 占满，主机整体卡顿。或者出现 `ChunkLoadError: Failed to load chunk ...` 错误。

### 根因

**Turbopack workspace root 误判。** Turbopack 会从项目目录向上查找 `package.json`、`pnpm-lock.yaml`、`pnpm-workspace.yaml` 等文件来推断 workspace root。如果上层目录（如 `~/`）存在这些文件，Turbopack 会将上层目录当作 workspace root，尝试扫描/编译整个目录树。

常见触发场景：

- `~/package.json` 中仅包含 `"packageManager": "pnpm@..."` 字段（某些工具自动生成）
- `~/pnpm-lock.yaml` 或 `~/pnpm-workspace.yaml` 残留

### 解决方案

1. **删除上层目录的干扰文件**（推荐）：

   ```bash
   # 检查 home 目录是否有干扰文件
   ls ~/package.json ~/pnpm-lock.yaml ~/pnpm-workspace.yaml 2>/dev/null

   # 删除它们
   rm -f ~/package.json ~/pnpm-lock.yaml ~/pnpm-workspace.yaml
   ```

2. **清理 `.next` 缓存后重启**：

   ```bash
   rm -rf .next
   bun dev
   ```

### 不要使用的方案

- ❌ `turbopack.root: "."` 或 `turbopack.root: __dirname` — 这会导致 chunk 路径解析错乱，产生 `ChunkLoadError`
- ❌ 在 `next.config.ts` 中设置相对路径的 `turbopack.root` — 行为不可预测

### 相关 Issue

- [#205 - perf: 首次 bun dev 编译极慢](https://github.com/guog/xinsight/issues/205)

---

## shiki 模块加载失败：Cannot find module '@shikijs/core' 或 '@shikijs/engine-oniguruma'

### 症状

```
Error: Failed to load external module shiki-xxx: Cannot find module '@shikijs/core'
```

### 根因

shiki v4 将核心拆分为多个包（`@shikijs/core`、`@shikijs/engine-oniguruma`、`@shikijs/engine-javascript`），但 Turbopack 将 shiki 作为 external module 加载时，无法正确解析这些 peer dependencies。

### 解决方案

1. 确保所有 shiki 子包已安装：

   ```bash
   bun add @shikijs/core @shikijs/engine-oniguruma
   ```

2. 在 `next.config.ts` 的 `serverExternalPackages` 中声明：

   ```ts
   serverExternalPackages: [
     // ... 其他包
     "shiki",
     "@shikijs/core",
     "@shikijs/engine-oniguruma",
     "@shikijs/engine-javascript",
   ]
   ```

3. 清理缓存重启：

   ```bash
   rm -rf .next
   bun dev
   ```
