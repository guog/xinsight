/**
 * 从收集到的流数据构建完整的 assistant parts 数组
 * 顺序：reasoning → tool-calls → text（与 AI SDK v6 UIMessage 结构一致）
 */
export function buildAssistantParts(
  reasoningText: string,
  assistantText: string,
  toolCalls: Map<string, { toolName: string; input?: unknown; output?: unknown }>,
): Array<Record<string, unknown>> {
  const parts: Array<Record<string, unknown>> = []

  if (reasoningText.trim()) {
    parts.push({ type: "reasoning", text: reasoningText, state: "done" })
  }

  for (const [toolCallId, tc] of toolCalls) {
    parts.push({
      type: `tool-${tc.toolName}`,
      toolCallId,
      toolName: tc.toolName,
      state: tc.output !== undefined ? "output-available" : "input-available",
      input: tc.input,
      output: tc.output,
    })
  }

  if (assistantText) {
    parts.push({ type: "text", text: assistantText })
  }

  return parts
}
