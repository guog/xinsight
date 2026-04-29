"use client"

import { useState } from "react"
import type { ResponseSchema, FieldDefinition } from "@/mastra/tools/datasource/types"

export interface SchemaEditorProps {
  schema: ResponseSchema
  onChange: (updated: ResponseSchema) => void
}

function EditableField({
  field,
  path,
  onDescriptionChange,
  depth = 0,
}: {
  field: FieldDefinition
  path: number[]
  onDescriptionChange: (path: number[], value: string) => void
  depth?: number
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(field.description ?? "")

  const commit = () => {
    setEditing(false)
    onDescriptionChange(path, draft)
  }

  return (
    <li className="py-1">
      <div className={`flex items-center gap-2 ${depth > 0 ? "ml-4" : ""}`}>
        <span className="font-mono text-sm font-semibold">{field.name}</span>
        <span className="font-mono text-xs text-gray-500">({field.type})</span>
        {editing ? (
          <input
            autoFocus
            className="flex-1 rounded border border-blue-300 px-1.5 py-0.5 text-xs"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === "Enter" && commit()}
          />
        ) : (
          <span
            className="flex-1 cursor-pointer text-xs text-gray-600 hover:bg-gray-50 hover:underline"
            onClick={() => setEditing(true)}
          >
            {field.description || "点击添加描述"}
          </span>
        )}
      </div>
      {field.children && field.children.length > 0 && (
        <ul className="ml-4 border-l border-gray-200 pl-2">
          {field.children.map((child, i) => (
            <EditableField
              key={child.name}
              field={child}
              path={[...path, i]}
              onDescriptionChange={onDescriptionChange}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

export function SchemaEditor({ schema, onChange }: SchemaEditorProps) {
  const updateDescription = (path: number[], value: string) => {
    const newFields = structuredClone(schema.fields)
    let target: FieldDefinition[] = newFields
    for (let i = 0; i < path.length - 1; i++) {
      target = target[path[i]].children!
    }
    target[path[path.length - 1]].description = value || undefined
    onChange({ ...schema, fields: newFields })
  }

  return (
    <ul className="space-y-1">
      {schema.fields.map((field, i) => (
        <EditableField
          key={field.name}
          field={field}
          path={[i]}
          onDescriptionChange={updateDescription}
        />
      ))}
    </ul>
  )
}
