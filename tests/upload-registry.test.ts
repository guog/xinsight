import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { mkdtemp, rm, writeFile, readFile } from "fs/promises"
import { join } from "path"
import { tmpdir } from "os"
import {
  checkDuplicate,
  registerUpload,
  computeSha256,
  loadRegistry,
} from "@/lib/wiki/upload-registry"

describe("upload-registry 去重", () => {
  let wikiPath: string

  beforeEach(async () => {
    wikiPath = await mkdtemp(join(tmpdir(), "wiki-reg-"))
  })

  afterEach(async () => {
    await rm(wikiPath, { recursive: true, force: true })
  })

  test("空注册表无重复", async () => {
    const buf = Buffer.from("hello world")
    const result = await checkDuplicate(buf, wikiPath)
    expect(result).toBeNull()
  })

  test("注册后能检测重复", async () => {
    const buf = Buffer.from("test content")
    const sha256 = computeSha256(buf)

    await registerUpload(wikiPath, {
      sha256,
      originalName: "test.txt",
      storedPath: "raw/uploads/test.txt",
      uploadedAt: new Date().toISOString(),
    })

    const dup = await checkDuplicate(buf, wikiPath)
    expect(dup).not.toBeNull()
    expect(dup!.originalName).toBe("test.txt")
  })

  test("不同内容不重复", async () => {
    const buf1 = Buffer.from("content A")
    const buf2 = Buffer.from("content B")

    await registerUpload(wikiPath, {
      sha256: computeSha256(buf1),
      originalName: "a.txt",
      storedPath: "raw/uploads/a.txt",
      uploadedAt: new Date().toISOString(),
    })

    const dup = await checkDuplicate(buf2, wikiPath)
    expect(dup).toBeNull()
  })

  test("注册表持久化", async () => {
    await registerUpload(wikiPath, {
      sha256: "abc123",
      originalName: "file.pdf",
      storedPath: "raw/uploads/file.pdf",
      uploadedAt: "2024-01-01T00:00:00.000Z",
    })

    const registry = await loadRegistry(wikiPath)
    expect(registry.uploads).toHaveLength(1)
    expect(registry.uploads[0].sha256).toBe("abc123")
  })
})
