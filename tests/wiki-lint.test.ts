import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { lintWiki } from "@/lib/wiki/lint"
import { mkdir, writeFile, rm } from "fs/promises"
import { join } from "path"

const TEST_WIKI = join(import.meta.dir, "__wiki_lint_test__")

describe("Wiki Lint", () => {
  beforeEach(async () => {
    await mkdir(join(TEST_WIKI, "entities"), { recursive: true })
    await mkdir(join(TEST_WIKI, "concepts"), { recursive: true })
    await mkdir(join(TEST_WIKI, "raw", "uploads"), { recursive: true })
  })

  afterEach(async () => {
    await rm(TEST_WIKI, { recursive: true, force: true })
  })

  test("应通过完整有效的 wiki 页面", async () => {
    await writeFile(
      join(TEST_WIKI, "entities", "test.md"),
      `---\ntitle: 测试实体\ntags: [test]\ncreated: 2024-01-01\ntype: entity\n---\n\n这是一个测试实体页面，内容足够长以通过质量检查。这是一段有意义的内容。`,
    )
    const report = await lintWiki(TEST_WIKI)
    // 可能有孤立页面警告，但不应有错误
    const errors = report.issues.filter((i) => i.severity === "error")
    expect(errors.length).toBe(0)
  })

  test("应检测缺少 frontmatter 的文件", async () => {
    await writeFile(join(TEST_WIKI, "entities", "no-fm.md"), "没有 frontmatter 的内容")
    const report = await lintWiki(TEST_WIKI)
    const structureIssues = report.issues.filter((i) => i.rule.id === "structure")
    expect(structureIssues.length).toBeGreaterThan(0)
  })

  test("应检测重复文件（SHA256 相同）", async () => {
    const content = `---\ntitle: 重复\ntags: [dup]\ncreated: 2024-01-01\ntype: entity\n---\n\n这是重复内容，足够长以通过质量检查。这是一段有意义的内容用于去重测试。`
    await writeFile(join(TEST_WIKI, "entities", "dup1.md"), content)
    await writeFile(join(TEST_WIKI, "concepts", "dup2.md"), content)
    const report = await lintWiki(TEST_WIKI)
    const dupIssues = report.issues.filter((i) => i.rule.id === "duplicates")
    expect(dupIssues.length).toBeGreaterThan(0)
  })

  test("应检测死链", async () => {
    await writeFile(
      join(TEST_WIKI, "entities", "linker.md"),
      `---\ntitle: 有链接的页面\ntags: [link]\ncreated: 2024-01-01\ntype: entity\n---\n\n参见 [[不存在的页面]] 了解更多。这里有足够多的内容。`,
    )
    const report = await lintWiki(TEST_WIKI)
    const deadLinks = report.issues.filter((i) => i.rule.id === "dead-links")
    expect(deadLinks.length).toBeGreaterThan(0)
  })

  test("应检测目录类型不匹配", async () => {
    await writeFile(
      join(TEST_WIKI, "entities", "wrong-type.md"),
      `---\ntitle: 错误类型\ntags: [test]\ncreated: 2024-01-01\ntype: concept\n---\n\n这个文件在 entities 目录但类型是 concept。这里有足够多的内容。`,
    )
    const report = await lintWiki(TEST_WIKI)
    const dirIssues = report.issues.filter((i) => i.rule.id === "directory")
    expect(dirIssues.length).toBeGreaterThan(0)
  })

  test("应检测上传文件缺少 extracted.md", async () => {
    await writeFile(join(TEST_WIKI, "raw", "uploads", "test.pdf"), "fake pdf")
    const report = await lintWiki(TEST_WIKI)
    const uploadIssues = report.issues.filter((i) => i.rule.id === "upload-integrity")
    expect(uploadIssues.length).toBeGreaterThan(0)
  })

  test("应支持进度回调", async () => {
    await writeFile(
      join(TEST_WIKI, "entities", "a.md"),
      `---\ntitle: A\ntags: [a]\ncreated: 2024-01-01\ntype: entity\n---\n\n内容 A 足够长。`,
    )
    let progressCalled = false
    await lintWiki(TEST_WIKI, {
      onProgress: () => {
        progressCalled = true
      },
    })
    expect(progressCalled).toBe(true)
  })

  test("应支持 AbortSignal 取消", async () => {
    await writeFile(
      join(TEST_WIKI, "entities", "a.md"),
      `---\ntitle: A\ntags: [a]\ncreated: 2024-01-01\ntype: entity\n---\n\n内容。`,
    )
    const controller = new AbortController()
    controller.abort()
    try {
      await lintWiki(TEST_WIKI, { signal: controller.signal })
      expect(true).toBe(false) // 不应到达这里
    } catch (err) {
      expect((err as Error).name).toBe("AbortError")
    }
  })
})
