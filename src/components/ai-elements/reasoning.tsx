"use client"

import { useControllableState } from "@radix-ui/react-use-controllable-state"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@radix-ui/react-collapsible"
import { cn } from "@/lib/utils"
import { Streamdown } from "streamdown"
import { cjk } from "@streamdown/cjk"
import { code } from "@streamdown/code"
import { math } from "@streamdown/math"
import { Brain, ChevronDown } from "lucide-react"
import type { ComponentProps, ReactNode } from "react"
import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

interface ReasoningContextValue {
  isStreaming: boolean
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  duration: number | undefined
}

const ReasoningContext = createContext<ReasoningContextValue | null>(null)

export const useReasoning = () => {
  const context = useContext(ReasoningContext)
  if (!context) {
    throw new Error("Reasoning components must be used within Reasoning")
  }
  return context
}

export type ReasoningProps = ComponentProps<typeof Collapsible> & {
  isStreaming?: boolean
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  duration?: number
}

const AUTO_CLOSE_DELAY = 1000
const MS_IN_S = 1000

export const Reasoning = memo(
  ({
    className,
    isStreaming = false,
    open,
    defaultOpen,
    onOpenChange,
    duration: durationProp,
    children,
    ...props
  }: ReasoningProps) => {
    const resolvedDefaultOpen = defaultOpen ?? isStreaming
    const isExplicitlyClosed = defaultOpen === false

    const [isOpen, setIsOpen] = useControllableState<boolean>({
      defaultProp: resolvedDefaultOpen,
      onChange: onOpenChange,
      prop: open,
    })
    const [duration, setDuration] = useControllableState<number | undefined>({
      defaultProp: undefined,
      prop: durationProp,
    })

    const hasEverStreamedRef = useRef(isStreaming)
    const [hasAutoClosed, setHasAutoClosed] = useState(false)
    const startTimeRef = useRef<number | null>(null)

    useEffect(() => {
      if (isStreaming) {
        hasEverStreamedRef.current = true
        if (startTimeRef.current === null) {
          startTimeRef.current = Date.now()
        }
      } else if (startTimeRef.current !== null) {
        setDuration(Math.ceil((Date.now() - startTimeRef.current) / MS_IN_S))
        startTimeRef.current = null
      }
    }, [isStreaming, setDuration])

    useEffect(() => {
      if (isStreaming && !isOpen && !isExplicitlyClosed) {
        setIsOpen(true)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isStreaming, isExplicitlyClosed])

    useEffect(() => {
      if (
        hasEverStreamedRef.current &&
        !isStreaming &&
        isOpen &&
        !hasAutoClosed
      ) {
        const timer = setTimeout(() => {
          setIsOpen(false)
          setHasAutoClosed(true)
        }, AUTO_CLOSE_DELAY)

        return () => clearTimeout(timer)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isStreaming, hasAutoClosed])

    const handleOpenChange = useCallback(
      (newOpen: boolean) => {
        setIsOpen(newOpen)
      },
      [setIsOpen],
    )

    const contextValue = useMemo(
      () => ({ duration, isOpen: isOpen ?? false, isStreaming, setIsOpen }),
      [duration, isOpen, isStreaming, setIsOpen],
    )

    return (
      <ReasoningContext.Provider value={contextValue}>
        <Collapsible
          className={cn("not-prose mb-4", className)}
          onOpenChange={handleOpenChange}
          open={isOpen}
          {...props}
        >
          {children}
        </Collapsible>
      </ReasoningContext.Provider>
    )
  },
)

export type ReasoningTriggerProps = ComponentProps<
  typeof CollapsibleTrigger
> & {
  getThinkingMessage?: (isStreaming: boolean, duration?: number) => ReactNode
}

const defaultGetThinkingMessage = (isStreaming: boolean, duration?: number) => {
  if (isStreaming || duration === 0) {
    return (
      <span className="inline-flex items-center gap-1.5">
        正在思考
        <span className="flex gap-0.5">
          <span className="size-1 rounded-full bg-current animate-bounce [animation-delay:0ms]" />
          <span className="size-1 rounded-full bg-current animate-bounce [animation-delay:150ms]" />
          <span className="size-1 rounded-full bg-current animate-bounce [animation-delay:300ms]" />
        </span>
      </span>
    )
  }
  if (duration === undefined) {
    return <span>思考了几秒</span>
  }
  return <span>思考了 {duration} 秒</span>
}

export const ReasoningTrigger = memo(
  ({
    className,
    children,
    getThinkingMessage = defaultGetThinkingMessage,
    ...props
  }: ReasoningTriggerProps) => {
    const { isStreaming, isOpen, duration } = useReasoning()

    return (
      <CollapsibleTrigger
        className={cn(
          "flex w-full items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground rounded-xl px-3 py-2.5",
          className,
        )}
        {...props}
      >
        {children ?? (
          <>
            <Brain
              className={cn(
                "size-4 shrink-0",
                isStreaming
                  ? "text-purple-500 animate-pulse"
                  : "text-purple-400 dark:text-purple-500",
              )}
            />
            <span className="flex-1 text-left font-medium text-purple-700 dark:text-purple-300">
              {getThinkingMessage(isStreaming, duration)}
            </span>
            <ChevronDown
              className={cn(
                "size-4 text-purple-400 transition-transform duration-200",
                isOpen ? "rotate-180" : "rotate-0",
              )}
            />
          </>
        )}
      </CollapsibleTrigger>
    )
  },
)

export type ReasoningContentProps = ComponentProps<
  typeof CollapsibleContent
> & {
  children: string
}

const streamdownPlugins = { cjk, code, math }

export const ReasoningContent = memo(
  ({ className, children, ...props }: ReasoningContentProps) => (
    <CollapsibleContent
      className={cn(
        "px-3 pb-3 text-sm text-purple-600/80 dark:text-purple-400/80",
        className,
      )}
      {...props}
    >
      <div className="leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto rounded-lg bg-purple-100/30 dark:bg-purple-900/10 p-2.5 border border-purple-200/30 dark:border-purple-800/20">
        <Streamdown plugins={streamdownPlugins}>{children}</Streamdown>
      </div>
    </CollapsibleContent>
  ),
)

Reasoning.displayName = "Reasoning"
ReasoningTrigger.displayName = "ReasoningTrigger"
ReasoningContent.displayName = "ReasoningContent"
