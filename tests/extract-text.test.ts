import { describe, test, expect } from "bun:test"
import { extractText } from "@/lib/wiki/extract-text"
import { writeFile, mkdir, rm } from "fs/promises"
import { join } from "path"

const TEST_DIR = join(import.meta.dir, "__fixtures__")

describe("extractText", () => {
  // 在测试前创建临时目录
  test("should extract text from .txt file", async () => {
    await mkdir(TEST_DIR, { recursive: true })
    const filePath = join(TEST_DIR, "test.txt")
    await writeFile(filePath, "Hello World\nLine 2")

    const result = await extractText(filePath)
    expect(result.text).toBe("Hello World\nLine 2")
    expect(result.error).toBeUndefined()

    await rm(TEST_DIR, { recursive: true })
  })

  test("should extract text from .csv file", async () => {
    await mkdir(TEST_DIR, { recursive: true })
    const filePath = join(TEST_DIR, "test.csv")
    await writeFile(filePath, "name,age\nAlice,30\nBob,25")

    const result = await extractText(filePath)
    expect(result.text).toContain("Alice")
    expect(result.text).toContain("Bob")

    await rm(TEST_DIR, { recursive: true })
  })

  test("should extract text from .json file", async () => {
    await mkdir(TEST_DIR, { recursive: true })
    const filePath = join(TEST_DIR, "test.json")
    await writeFile(filePath, JSON.stringify({ key: "value" }))

    const result = await extractText(filePath)
    expect(result.text).toContain("key")

    await rm(TEST_DIR, { recursive: true })
  })

  test("should return error for non-existent file", async () => {
    const result = await extractText("/tmp/nonexistent-file-xyz.pdf")
    expect(result.error).toBeDefined()
    expect(result.text).toBe("")
  })

  test("should handle xlsx extraction", async () => {
    // 创建一个简单的 xlsx 文件用于测试
    await mkdir(TEST_DIR, { recursive: true })
    const XLSX = await import("xlsx")
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([
      ["Name", "Score"],
      ["Alice", 95],
      ["Bob", 88],
    ])
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1")
    const filePath = join(TEST_DIR, "test.xlsx")
    XLSX.writeFile(wb, filePath)

    const result = await extractText(filePath)
    expect(result.text).toContain("Alice")
    expect(result.text).toContain("95")
    expect(result.text).toContain("Sheet1")
    expect(result.error).toBeUndefined()

    await rm(TEST_DIR, { recursive: true })
  })
})
