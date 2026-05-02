/**
 * 批量提取 raw/uploads 下所有文件为 .extracted.md
 * 用法: bun run scripts/batch-extract.ts
 */
import { readdirSync } from "fs"
import { writeFile, mkdir } from "fs/promises"
import { join, basename } from "path"
import { extractText } from "../src/lib/wiki/extract-text"

const UPLOADS_DIR = join(import.meta.dir, "../raw/uploads")
const OUTPUT_DIR = join(import.meta.dir, "../wiki/knowledge")

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true })

  const files = readdirSync(UPLOADS_DIR).filter(
    (f) => !f.startsWith(".") && !f.endsWith(".extracted.md"),
  )

  console.log(`发现 ${files.length} 个文件待处理\n`)

  for (const file of files) {
    const filePath = join(UPLOADS_DIR, file)
    console.log(`处理: ${file}`)

    const { text, error } = await extractText(filePath)
    if (error) {
      console.log(`  ❌ 错误: ${error}`)
      continue
    }

    const mdName = basename(file).replace(/\.[^.]+$/, ".md")
    const outputPath = join(OUTPUT_DIR, mdName)
    await writeFile(outputPath, text, "utf-8")
    console.log(`  ✅ 提取成功: ${text.length} 字符 → ${mdName}`)
  }

  console.log("\n完成!")
}

main()
