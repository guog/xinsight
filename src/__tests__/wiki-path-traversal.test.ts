import { describe, it, expect, vi } from "vitest"
import { resolve } from "path"

// 直接测试 wiki-read 的路径遍历防护
// 因为 safePath 是内部函数，我们通过工具的 execute 函数间接测试

// Mock fs/promises
vi.mock("fs/promises", () => ({
  readFile: vi.fn().mockResolvedValue("# Test"),
  readdir: vi.fn().mockResolvedValue([]),
  writeFile: vi.fn(),
  appendFile: vi.fn(),
  access: vi.fn(),
  unlink: vi.fn(),
  rename: vi.fn(),
  mkdir: vi.fn(),
  stat: vi.fn(),
}))

vi.mock("fs", () => ({
  mkdirSync: vi.fn(),
}))

describe("Wiki 路径遍历防护", () => {
  it("wiki-read 拒绝 ../etc/passwd 路径遍历", async () => {
    const { wikiReadTool } = await import("@/mastra/tools/wiki/index")
    const result = await wikiReadTool.execute!({ path: "../../../etc/passwd" }, {} as never)
    expect(result).toEqual({ success: false, error: "路径不合法" })
  })

  it("wiki-read 拒绝绝对路径", async () => {
    const { wikiReadTool } = await import("@/mastra/tools/wiki/index")
    const result = await wikiReadTool.execute!({ path: "/etc/passwd" }, {} as never)
    expect(result).toEqual({ success: false, error: "路径不合法" })
  })

  it("wiki-read 允许正常相对路径", async () => {
    const { wikiReadTool } = await import("@/mastra/tools/wiki/index")
    const result = await wikiReadTool.execute!({ path: "entities/test.md" }, {} as never)
    expect(result).toEqual({ success: true, content: "# Test" })
  })

  it("wiki-ingest 跳过非 .md 文件", async () => {
    const { wikiIngestTool } = await import("@/mastra/tools/wiki/index")
    const result = await wikiIngestTool.execute!(
      {
        filePath: "raw/uploads/test.pdf",
        pages: [{ path: "entities/test.sh", content: "#!/bin/bash\nrm -rf /" }],
      },
      {} as never,
    )
    // 非 .md 文件被跳过，created=0, updated=0
    expect(result.pagesCreated).toBe(0)
    expect(result.pagesUpdated).toBe(0)
  })

  it("wiki-ingest 跳过路径遍历", async () => {
    const { wikiIngestTool } = await import("@/mastra/tools/wiki/index")
    const result = await wikiIngestTool.execute!(
      {
        filePath: "raw/uploads/test.pdf",
        pages: [{ path: "../../etc/cron.d/evil.md", content: "hacked" }],
      },
      {} as never,
    )
    expect(result.pagesCreated).toBe(0)
    expect(result.pagesUpdated).toBe(0)
  })
})
