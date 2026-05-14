import * as fs from "fs"
import * as path from "path"
import { stat } from "fs/promises"

// 忽略的文件模式
const IGNORED_PATTERNS = [".registry.json", ".DS_Store"]

const IGNORED_EXTENSIONS = [".extracted.md", ".tmp", ".crdownload", ".part"]

// HMR 安全: 用 globalThis 存储 watcher 引用
const GLOBAL_KEY = "__xinsight_file_watcher__"

function getGlobalState() {
  if (!(globalThis as Record<string, unknown>)[GLOBAL_KEY]) {
    ;(globalThis as Record<string, unknown>)[GLOBAL_KEY] = { watcher: null, running: false }
  }
  return (globalThis as Record<string, unknown>)[GLOBAL_KEY] as {
    watcher: fs.FSWatcher | null
    running: boolean
  }
}

// 判断文件是否应被忽略
function shouldIgnore(filename: string): boolean {
  if (IGNORED_PATTERNS.includes(filename)) return true
  for (const ext of IGNORED_EXTENSIONS) {
    if (filename.endsWith(ext)) return true
  }
  return false
}

// debounce 计时器映射
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>()

export function startFileWatcher(
  uploadsDir: string,
  options: { onNewFile: (filePath: string) => Promise<void> },
): void {
  const state = getGlobalState()

  // 防重入
  if (state.running) return

  state.running = true
  state.watcher = fs.watch(uploadsDir, (eventType, filename) => {
    if (!filename || eventType !== "rename") return
    if (shouldIgnore(filename)) return

    const filePath = path.join(uploadsDir, filename)

    // 安全检查：确保解析后的路径在 uploadsDir 内
    const resolvedBase = path.resolve(uploadsDir) + "/"
    if (!path.resolve(filePath).startsWith(resolvedBase)) return

    // debounce 500ms
    if (debounceTimers.has(filePath)) {
      clearTimeout(debounceTimers.get(filePath)!)
    }

    debounceTimers.set(
      filePath,
      setTimeout(async () => {
        debounceTimers.delete(filePath)
        try {
          // 稳定性检测: 先获取 size
          const stat1 = await stat(filePath)
          const size1 = stat1.size

          // 等待 1s 后再次检查
          await new Promise((r) => setTimeout(r, 1000))

          // 检查 watcher 是否已停止
          if (!getGlobalState().running) return

          const stat2 = await stat(filePath)
          if (stat2.size === size1) {
            await options.onNewFile(filePath)
          }
        } catch {
          // 文件可能已被删除，忽略
        }
      }, 500),
    )
  })
}

export function stopFileWatcher(): void {
  const state = getGlobalState()
  if (state.watcher) {
    state.watcher.close()
    state.watcher = null
  }
  state.running = false
  // 清理所有 debounce 计时器
  for (const timer of Array.from(debounceTimers.values())) {
    clearTimeout(timer)
  }
  debounceTimers.clear()
}
