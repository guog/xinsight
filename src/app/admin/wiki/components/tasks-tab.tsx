"use client"

import { useEffect, useState, useRef } from "react"

// 任务面板标签
interface Task {
  id: string
  type: string
  status: "running" | "paused" | "completed" | "failed" | "cancelled"
  progress: number
  current?: string
  createdAt: string
  updatedAt: string
}

const statusColors: Record<string, string> = {
  running: "bg-blue-100 text-blue-700",
  paused: "bg-yellow-100 text-yellow-700",
  completed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-700",
}

const statusLabels: Record<string, string> = {
  running: "运行中",
  paused: "已暂停",
  completed: "已完成",
  failed: "失败",
  cancelled: "已取消",
}

export default function TasksTab() {
  const [tasks, setTasks] = useState<Task[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchTasks = async () => {
    try {
      const res = await fetch("/api/wiki/admin/tasks")
      const data = await res.json()
      setTasks(data.tasks || data || [])
    } catch (e) {
      console.error("获取任务失败", e)
    }
  }

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    void fetchTasks()
    timerRef.current = setInterval(() => {
      void fetchTasks()
    }, 2000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

  const control = async (id: string, action: string) => {
    await fetch(`/api/wiki/admin/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    })
    fetchTasks()
  }

  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="p-2">ID</th>
            <th className="p-2">类型</th>
            <th className="p-2">状态</th>
            <th className="p-2">进度</th>
            <th className="p-2">创建时间</th>
            <th className="p-2">更新时间</th>
            <th className="p-2">操作</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id} className="border-b">
              <td className="p-2 font-mono text-xs">{task.id.slice(0, 8)}</td>
              <td className="p-2">{task.type}</td>
              <td className="p-2">
                <span className={`px-2 py-0.5 rounded text-xs ${statusColors[task.status] || ""}`}>
                  {statusLabels[task.status] || task.status}
                </span>
              </td>
              <td className="p-2 w-48">
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 rounded h-2">
                    <div
                      className="bg-blue-600 h-2 rounded transition-all"
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>
                  <span className="text-xs">{task.progress}%</span>
                </div>
                {task.current && (
                  <div className="text-xs text-gray-500 truncate">{task.current}</div>
                )}
              </td>
              <td className="p-2 text-xs">{new Date(task.createdAt).toLocaleString("zh-CN")}</td>
              <td className="p-2 text-xs">{new Date(task.updatedAt).toLocaleString("zh-CN")}</td>
              <td className="p-2 flex gap-1">
                {task.status === "running" && (
                  <>
                    <button
                      onClick={() => control(task.id, "pause")}
                      className="px-2 py-1 bg-yellow-500 text-white rounded text-xs"
                    >
                      暂停
                    </button>
                    <button
                      onClick={() => control(task.id, "cancel")}
                      className="px-2 py-1 bg-gray-500 text-white rounded text-xs"
                    >
                      取消
                    </button>
                  </>
                )}
                {task.status === "paused" && (
                  <>
                    <button
                      onClick={() => control(task.id, "resume")}
                      className="px-2 py-1 bg-green-600 text-white rounded text-xs"
                    >
                      继续
                    </button>
                    <button
                      onClick={() => control(task.id, "cancel")}
                      className="px-2 py-1 bg-gray-500 text-white rounded text-xs"
                    >
                      取消
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {tasks.length === 0 && <div className="text-center text-gray-400 py-8">暂无任务</div>}
    </div>
  )
}
