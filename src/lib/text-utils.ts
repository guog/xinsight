/** 按句子分割文本，返回 [完整句子们, 剩余部分] */
export function splitSentences(text: string): [string[], string] {
  const sentenceEnders = /([。！？.!?\n])/
  const parts = text.split(sentenceEnders)
  const sentences: string[] = []
  let i = 0
  while (i < parts.length - 1) {
    if (sentenceEnders.test(parts[i + 1] ?? "")) {
      sentences.push(parts[i]! + parts[i + 1]!)
      i += 2
    } else {
      sentences.push(parts[i]!)
      i += 1
    }
  }
  const remainder = i < parts.length ? parts[i]! : ""
  return [sentences.filter((s) => s.trim().length > 0), remainder]
}
