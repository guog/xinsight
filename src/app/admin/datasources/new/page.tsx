"use client"

import DatasourceForm from "@/components/datasource-form"

export default function NewDatasourcePage() {
  return (
    <div className="animate-in fade-in duration-300">
      <h2 className="text-lg font-medium mb-6">新建数据源</h2>
      <DatasourceForm />
    </div>
  )
}
