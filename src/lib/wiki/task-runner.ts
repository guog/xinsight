// 任务运行器 - 管理 Wiki 相关异步任务

export type TaskStatus = "idle" | "running" | "paused" | "completed" | "cancelled" | "failed"

export type WikiTask = {
  id: string
  type: "lint" | "ingest" | "auto-fix"
  status: TaskStatus
  progress: { current: number; total: number; currentFile: string }
  createdAt: string
  startedAt?: string
  completedAt?: string
  result?: unknown
  error?: string
}

// 任务执行上下文
export type TaskContext = {
  signal: AbortSignal
  isPaused: () => boolean
  waitIfPaused: () => Promise<void>
  reportProgress: (current: number, total: number, file: string) => void
}

type TaskExecutor = (ctx: TaskContext) => Promise<unknown>

// 内部任务状态
interface InternalTask {
  task: WikiTask
  controller: AbortController
  paused: boolean
  resumeResolve: (() => void) | null
}

// 任务运行器，单例模式
export class TaskRunner {
  private tasks: Map<string, InternalTask> = new Map()
  private history: WikiTask[] = []

  // 创建并启动任务
  createTask(type: WikiTask["type"], executor: TaskExecutor): WikiTask {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const task: WikiTask = {
      id,
      type,
      status: "running",
      progress: { current: 0, total: 0, currentFile: "" },
      createdAt: now,
      startedAt: now,
    }

    const controller = new AbortController()
    const internal: InternalTask = {
      task,
      controller,
      paused: false,
      resumeResolve: null,
    }

    this.tasks.set(id, internal)

    // 构建执行上下文
    const ctx: TaskContext = {
      signal: controller.signal,
      isPaused: () => internal.paused,
      waitIfPaused: () => {
        if (!internal.paused) return Promise.resolve()
        return new Promise<void>((resolve) => {
          internal.resumeResolve = resolve
        })
      },
      reportProgress: (current, total, file) => {
        task.progress = { current, total, currentFile: file }
      },
    }

    // 异步执行任务
    executor(ctx)
      .then((result) => {
        if (task.status === "running" || task.status === "paused") {
          task.status = "completed"
          task.result = result
          task.completedAt = new Date().toISOString()
          this.archiveTask(id)
        }
      })
      .catch((err) => {
        if (task.status === "cancelled") return
        task.status = "failed"
        task.error = err?.message ?? String(err)
        task.completedAt = new Date().toISOString()
        this.archiveTask(id)
      })

    return task
  }

  getTask(id: string): WikiTask | undefined {
    return this.tasks.get(id)?.task ?? this.history.find((t) => t.id === id)
  }

  getAllTasks(): WikiTask[] {
    const active = Array.from(this.tasks.values()).map((i) => i.task)
    return [...active, ...this.history]
  }

  // 暂停任务
  pauseTask(id: string): boolean {
    const internal = this.tasks.get(id)
    if (!internal || internal.task.status !== "running") return false
    internal.paused = true
    internal.task.status = "paused"
    return true
  }

  // 恢复任务
  resumeTask(id: string): boolean {
    const internal = this.tasks.get(id)
    if (!internal || internal.task.status !== "paused") return false
    internal.paused = false
    internal.task.status = "running"
    if (internal.resumeResolve) {
      internal.resumeResolve()
      internal.resumeResolve = null
    }
    return true
  }

  // 取消任务
  cancelTask(id: string): boolean {
    const internal = this.tasks.get(id)
    if (!internal) return false
    if (internal.task.status !== "running" && internal.task.status !== "paused") return false
    internal.task.status = "cancelled"
    internal.task.completedAt = new Date().toISOString()
    internal.controller.abort()
    // 如果暂停中，释放等待
    if (internal.resumeResolve) {
      internal.resumeResolve()
      internal.resumeResolve = null
    }
    this.archiveTask(id)
    return true
  }

  // 归档已完成任务，保留最近 20 条
  private archiveTask(id: string) {
    const internal = this.tasks.get(id)
    if (!internal) return
    this.tasks.delete(id)
    this.history.unshift(internal.task)
    if (this.history.length > 20) {
      this.history = this.history.slice(0, 20)
    }
  }
}

// 导出单例
export const taskRunner = new TaskRunner()
