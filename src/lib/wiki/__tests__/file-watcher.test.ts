import { describe, test, expect, afterEach } from "bun:test"
import { startFileWatcher, stopFileWatcher } from "../file-watcher"
import { mkdtemp, writeFile } from "fs/promises"
import path from "path"
import os from "os"

// 辅助函数: 等待指定毫秒
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe("file-watcher", () => {
  afterEach(() => {
    stopFileWatcher()
  })

  test("忽略指定文件不触发回调", async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "fw-test-"))
    const called: string[] = []

    startFileWatcher(tmpDir, {
      onNewFile: async (fp) => {
        called.push(fp)
      },
    })

    // 写入应被忽略的文件
    await writeFile(path.join(tmpDir, ".registry.json"), "{}")
    await writeFile(path.join(tmpDir, "test.extracted.md"), "x")
    await writeFile(path.join(tmpDir, "file.tmp"), "x")
    await writeFile(path.join(tmpDir, "file.crdownload"), "x")
    await writeFile(path.join(tmpDir, "file.part"), "x")
    await writeFile(path.join(tmpDir, ".DS_Store"), "x")

    // 等待足够时间 (debounce 500ms + 稳定性 1000ms + buffer)
    await wait(2000)

    expect(called).toEqual([])
  })

  test("新文件触发 onNewFile 回调", async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "fw-test-"))
    const called: string[] = []

    startFileWatcher(tmpDir, {
      onNewFile: async (fp) => {
        called.push(fp)
      },
    })

    // 写入正常文件
    const filePath = path.join(tmpDir, "document.pdf")
    await writeFile(filePath, "pdf content here")

    // 等待 debounce + 稳定性检测
    await wait(2500)

    expect(called).toContain(filePath)
  })

  test("stopFileWatcher 停止后不再触发", async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "fw-test-"))
    const called: string[] = []

    startFileWatcher(tmpDir, {
      onNewFile: async (fp) => {
        called.push(fp)
      },
    })

    stopFileWatcher()

    // 停止后写入文件
    await writeFile(path.join(tmpDir, "new-file.pdf"), "content")
    await wait(2000)

    expect(called).toEqual([])
  })
})
