"use client"

import type { ResponseSchema, FieldDefinition } from "@/mastra/tools/datasource/types"

const sourceLabels: Record<string, string> = {
  manual: "手动",
  inferred: "推断",
  openapi: "OpenAPI",
  introspection: "Introspection",
}

function FieldTree({ fields, depth = 0 }: { fields: FieldDefinition[]; depth?: number }) {
  return (
    <ul className={depth > 0 ? "ml-4 border-l border-gray-200 pl-2" : ""}>
      {fields.map((field) => (
        <li key={field.name} className="py-0.5">
          <span className="font-mono text-sm">
            <span className="font-semibold">{field.name}</span>
            <span className="text-gray-500">({field.type})</span>
          </span>
          {field.description && (
            <span className="ml-2 text-xs text-gray-600">— {field.description}</span>
          )}
          {field.children && field.children.length > 0 && (
            <FieldTree fields={field.children} depth={depth + 1} />
          )}
        </li>
      ))}
    </ul>
  )
}

export interface SchemaViewerProps {
  schema: ResponseSchema | undefined
  onDiscover?: () => void
  discovering?: boolean
}

export function SchemaViewer({ schema, onDiscover, discovering }: SchemaViewerProps) {
  if (!schema) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-gray-300 p-8 text-center">
        <p className="text-sm text-gray-500">暂无 Schema 信息</p>
        {onDiscover && (
          <button
            onClick={onDiscover}
            disabled={discovering}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {discovering ? "探测中..." : "探测 Schema"}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {schema.source && (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
            {sourceLabels[schema.source] ?? schema.source}
          </span>
        )}
        {schema.discoveredAt && (
          <span className="text-xs text-gray-400">
            {new Date(schema.discoveredAt).toLocaleString()}
          </span>
        )}
      </div>
      {schema.description && <p className="text-sm text-gray-600">{schema.description}</p>}
      <FieldTree fields={schema.fields} />
    </div>
  )
}
