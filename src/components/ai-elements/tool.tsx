"use client"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@radix-ui/react-collapsible"
import { cn } from "@/lib/utils"
import {
  CheckCircle,
  ChevronDown,
  Circle,
  Clock,
  Wrench,
  XCircle,
} from "lucide-react"
import type { ComponentProps, ReactNode } from "react"

export type ToolProps = ComponentProps<typeof Collapsible>

export const Tool = ({ className, ...props }: ToolProps) => (
  <Collapsible
    className={cn("group not-prose mb-4 w-full rounded-md border", className)}
    {...props}
  />
)

export type ToolState =
  | "input-streaming"
  | "input-available"
  | "output-available"
  | "output-error"

export type ToolHeaderProps = ComponentProps<typeof CollapsibleTrigger> & {
  title?: string
  state: ToolState
  toolName?: string
}

const statusLabels: Record<ToolState, string> = {
  "input-available": "执行中",
  "input-streaming": "准备中",
  "output-available": "已完成",
  "output-error": "出错",
}

const statusIcons: Record<ToolState, ReactNode> = {
  "input-available": <Clock className="size-3.5 animate-pulse text-blue-500" />,
  "input-streaming": <Circle className="size-3.5 text-muted-foreground" />,
  "output-available": <CheckCircle className="size-3.5 text-green-500" />,
  "output-error": <XCircle className="size-3.5 text-red-500" />,
}

export const ToolHeader = ({
  className,
  title,
  state,
  toolName,
  children,
  ...props
}: ToolHeaderProps) => {
  const displayName = title ?? toolName ?? "工具"

  return (
    <CollapsibleTrigger
      className={cn(
        "flex w-full items-center justify-between gap-4 p-3",
        className,
      )}
      {...props}
    >
      {children ?? (
        <>
          <div className="flex items-center gap-2">
            <Wrench className="size-4 text-muted-foreground" />
            <span className="font-medium text-sm">{displayName}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {statusIcons[state]}
              {statusLabels[state]}
            </span>
          </div>
          <ChevronDown className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
        </>
      )}
    </CollapsibleTrigger>
  )
}

export type ToolContentProps = ComponentProps<typeof CollapsibleContent>

export const ToolContent = ({ className, ...props }: ToolContentProps) => (
  <CollapsibleContent
    className={cn("space-y-4 p-4 text-sm", className)}
    {...props}
  />
)

export type ToolInputProps = ComponentProps<"div"> & {
  input: unknown
}

export const ToolInput = ({ className, input, ...props }: ToolInputProps) => (
  <div className={cn("space-y-2 overflow-hidden", className)} {...props}>
    <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
      请求参数
    </h4>
    <div className="rounded-md bg-muted/50">
      <pre className="text-xs p-3 font-mono overflow-x-auto">
        {JSON.stringify(input, null, 2)}
      </pre>
    </div>
  </div>
)

export type ToolOutputProps = ComponentProps<"div"> & {
  output: unknown
  errorText?: string
}

export const ToolOutput = ({
  className,
  output,
  errorText,
  ...props
}: ToolOutputProps) => {
  if (!(output || errorText)) return null

  const text =
    typeof output === "string"
      ? output
      : typeof output === "object"
        ? JSON.stringify(output, null, 2)
        : String(output ?? "")

  return (
    <div className={cn("space-y-2", className)} {...props}>
      <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
        {errorText ? "错误" : "返回结果"}
      </h4>
      <div
        className={cn(
          "overflow-x-auto rounded-md text-xs",
          errorText
            ? "bg-destructive/10 text-destructive p-3"
            : "bg-muted/50",
        )}
      >
        {errorText && <div className="p-3">{errorText}</div>}
        {!errorText && (
          <pre className="p-3 font-mono max-h-64 overflow-y-auto">{text}</pre>
        )}
      </div>
    </div>
  )
}
