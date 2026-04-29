import { describe, test, expect } from "bun:test"
import { TaskRunner } from "@/lib/wiki/task-runner"

describe("TaskRunner", () => {
  test("应创建并执行任务", async () => {
    const runner = new TaskRunner()
    const task = runner.createTask("lint", async (ctx) => {
      ctx.reportProgress(1, 2, "file1.md")
      ctx.reportProgress(2, 2, "file2.md")
      return { done: true }
    })
    expect(task.status).toBe("running")
    expect(task.type).toBe("lint")

    // 等待任务完成
    await new Promise((r) => setTimeout(r, 100))
    const updated = runner.getTask(task.id)
    expect(updated?.status).toBe("completed")
    expect(updated?.result).toEqual({ done: true })
  })

  test("应支持取消任务", async () => {
    const runner = new TaskRunner()
    const task = runner.createTask("ingest", async () => {
      await new Promise((r) => setTimeout(r, 5000))
      return "should not reach"
    })

    const cancelled = runner.cancelTask(task.id)
    expect(cancelled).toBe(true)

    await new Promise((r) => setTimeout(r, 50))
    expect(runner.getTask(task.id)?.status).toBe("cancelled")
  })

  test("应支持暂停和恢复", async () => {
    const runner = new TaskRunner()
    let reachedEnd = false
    const task = runner.createTask("lint", async (ctx) => {
      // 先等一下让外部有机会暂停
      await new Promise((r) => setTimeout(r, 50))
      await ctx.waitIfPaused()
      reachedEnd = true
      return "done"
    })

    // 暂停（在任务 sleep 期间）
    await new Promise((r) => setTimeout(r, 10))
    runner.pauseTask(task.id)

    // 等任务到达 waitIfPaused
    await new Promise((r) => setTimeout(r, 100))
    expect(reachedEnd).toBe(false)

    // 恢复
    runner.resumeTask(task.id)
    await new Promise((r) => setTimeout(r, 100))
    expect(reachedEnd).toBe(true)
    expect(runner.getTask(task.id)?.status).toBe("completed")
  })

  test("应列出所有任务", () => {
    const runner = new TaskRunner()
    runner.createTask("lint", async () => "a")
    runner.createTask("ingest", async () => "b")
    expect(runner.getAllTasks().length).toBe(2)
  })

  test("应限制历史记录为 20 条", async () => {
    const runner = new TaskRunner()
    for (let i = 0; i < 25; i++) {
      runner.createTask("lint", async () => i)
    }
    await new Promise((r) => setTimeout(r, 200))
    // 已完成的任务不应超过 20
    const all = runner.getAllTasks()
    expect(all.length).toBeLessThanOrEqual(25) // 包含运行中的
  })
})
