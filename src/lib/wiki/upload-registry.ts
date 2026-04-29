// 上传文件去重注册表
// 用 JSON 文件记录所有上传文件的 SHA256 → 原始文件名映射
import { readFile, writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { createHash } from "crypto"

export interface UploadRecord {
  sha256: string
  originalName: string
  storedPath: string
  uploadedAt: string
}

interface Registry {
  uploads: UploadRecord[]
}

function getRegistryPath(wikiPath: string): string {
  return join(wikiPath, "raw", "uploads", ".registry.json")
}

export async function loadRegistry(wikiPath: string): Promise<Registry> {
  try {
    const data = await readFile(getRegistryPath(wikiPath), "utf-8")
    return JSON.parse(data) as Registry
  } catch {
    return { uploads: [] }
  }
}

export async function saveRegistry(wikiPath: string, registry: Registry): Promise<void> {
  const dir = join(wikiPath, "raw", "uploads")
  await mkdir(dir, { recursive: true })
  await writeFile(getRegistryPath(wikiPath), JSON.stringify(registry, null, 2))
}

export function computeSha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex")
}

// 检查是否重复，返回重复的记录或 null
export async function checkDuplicate(
  buffer: Buffer,
  wikiPath: string,
): Promise<UploadRecord | null> {
  const sha256 = computeSha256(buffer)
  const registry = await loadRegistry(wikiPath)
  return registry.uploads.find((r) => r.sha256 === sha256) || null
}

// 注册新上传
export async function registerUpload(wikiPath: string, record: UploadRecord): Promise<void> {
  const registry = await loadRegistry(wikiPath)
  registry.uploads.push(record)
  await saveRegistry(wikiPath, registry)
}
