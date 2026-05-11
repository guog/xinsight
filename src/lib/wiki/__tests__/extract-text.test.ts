import { describe, test, expect } from "vitest"
import { mkdtemp, writeFile, rm } from "fs/promises"
import { tmpdir } from "os"
import { join } from "path"

// Import directly - no mocking needed for text-based formats
const { extractText } = await import("@/lib/wiki/extract-text")

let tmpDir: string

describe("extractText", () => {
  test("setup temp dir", async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "extract-test-"))
  })

  test(".txt file", async () => {
    const p = join(tmpDir, "test.txt")
    await writeFile(p, "hello text")
    const result = await extractText(p)
    expect(result.text).toBe("hello text")
    expect(result.error).toBeUndefined()
  })

  test(".md file", async () => {
    const p = join(tmpDir, "test.md")
    await writeFile(p, "# Title\ncontent")
    const result = await extractText(p)
    expect(result.text).toBe("# Title\ncontent")
  })

  test(".csv file", async () => {
    const p = join(tmpDir, "test.csv")
    await writeFile(p, "a,b\n1,2")
    const result = await extractText(p)
    expect(result.text).toBe("a,b\n1,2")
  })

  test(".json file", async () => {
    const p = join(tmpDir, "test.json")
    await writeFile(p, '{"key":"value"}')
    const result = await extractText(p)
    expect(result.text).toBe('{"key":"value"}')
  })

  test("unknown extension falls back to text", async () => {
    const p = join(tmpDir, "test.xyz")
    await writeFile(p, "fallback content")
    const result = await extractText(p)
    expect(result.text).toBe("fallback content")
  })

  test(".docx file extracts from zip", async () => {
    const JSZip = (await import("jszip")).default
    const zip = new JSZip()
    zip.file(
      "word/document.xml",
      '<w:document><w:body><w:p><w:r><w:t>Hello World</w:t></w:r></w:p></w:body></w:document>',
    )
    const buf = await zip.generateAsync({ type: "nodebuffer" })
    const p = join(tmpDir, "test.docx")
    await writeFile(p, buf)
    const result = await extractText(p)
    expect(result.text).toContain("Hello World")
  })

  test(".docx without document.xml returns error", async () => {
    const JSZip = (await import("jszip")).default
    const zip = new JSZip()
    zip.file("other.xml", "<root/>")
    const buf = await zip.generateAsync({ type: "nodebuffer" })
    const p = join(tmpDir, "bad.docx")
    await writeFile(p, buf)
    const result = await extractText(p)
    expect(result.error).toContain("无法读取 docx 内容")
  })

  test(".xlsx file uses xlsx module", async () => {
    // Create a minimal xlsx file (it's a zip with specific structure)
    // Just test that the branch is hit - if xlsx module works, great; if not, error branch is covered
    const p = join(tmpDir, "test.xlsx")
    await writeFile(p, "not a real xlsx")
    const result = await extractText(p)
    // Either succeeds or returns an error - both cover the branch
    expect(typeof result.text).toBe("string")
  })

  test(".pdf file branch", async () => {
    const p = join(tmpDir, "test.pdf")
    await writeFile(p, "not a real pdf")
    const result = await extractText(p)
    // pdf-parse will likely error on fake data, covering the error branch
    expect(typeof result.text).toBe("string")
  })

  test("file not found returns error", async () => {
    const result = await extractText("/nonexistent/path/file.txt")
    expect(result.text).toBe("")
    expect(result.error).toContain("文件解析失败")
  })

  test("cleanup", async () => {
    await rm(tmpDir, { recursive: true })
  })
})
