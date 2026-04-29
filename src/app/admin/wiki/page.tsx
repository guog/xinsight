"use client"

import { useState } from "react"
import PagesTab from "./components/pages-tab"
import UploadsTab from "./components/uploads-tab"
import LintTab from "./components/lint-tab"
import TasksTab from "./components/tasks-tab"

// Wiki 管理主页面
const tabs = ["页面管理", "上传管理", "Lint 检查", "任务面板"] as const

export default function WikiAdminPage() {
  const [active, setActive] = useState<string>(tabs[0])

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Wiki 管理</h1>
      {/* 标签栏 */}
      <div className="flex border-b mb-4">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActive(tab)}
            className={`px-4 py-2 -mb-px font-medium ${
              active === tab
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
      {/* 标签内容 */}
      {active === "页面管理" && <PagesTab />}
      {active === "上传管理" && <UploadsTab />}
      {active === "Lint 检查" && <LintTab />}
      {active === "任务面板" && <TasksTab />}
    </div>
  )
}
