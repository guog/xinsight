"use client"

import { cn } from "@/lib/utils"
import type { ComponentProps } from "react"
import { useCallback } from "react"

export type SuggestionsProps = ComponentProps<"div">

export const Suggestions = ({
  className,
  children,
  ...props
}: SuggestionsProps) => (
  <div className="w-full overflow-x-auto" {...props}>
    <div className={cn("flex w-max flex-nowrap items-center gap-2", className)}>
      {children}
    </div>
  </div>
)

export type SuggestionProps = Omit<
  ComponentProps<"button">,
  "onClick"
> & {
  suggestion: string
  onClick?: (suggestion: string) => void
}

export const Suggestion = ({
  suggestion,
  onClick,
  className,
  children,
  ...props
}: SuggestionProps) => {
  const handleClick = useCallback(() => {
    onClick?.(suggestion)
  }, [onClick, suggestion])

  return (
    <button
      className={cn(
        "cursor-pointer rounded-full border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors",
        className,
      )}
      onClick={handleClick}
      type="button"
      {...props}
    >
      {children || suggestion}
    </button>
  )
}
