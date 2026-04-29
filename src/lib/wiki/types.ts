import { z } from "zod"

// Wiki 页面的 frontmatter 结构
export interface WikiPageMeta {
  title: string
  created: string
  updated: string
  type: "entity" | "concept" | "comparison" | "query" | "summary"
  tags: string[]
  sources: string[]
  confidence?: "high" | "medium" | "low"
}

// 上传文件的元信息
export interface UploadedFile {
  id: string
  originalName: string
  storedPath: string // wiki/raw/uploads/ 下的路径
  mimeType: string
  size: number
  uploadedAt: string
  ingestedAt?: string // wiki ingest 完成时间
}

// Wiki 搜索结果
export interface WikiSearchResult {
  path: string
  title: string
  type: string
  snippet: string
  score: number
}

export const uploadedFileSchema = z.object({
  id: z.string(),
  originalName: z.string(),
  storedPath: z.string(),
  mimeType: z.string(),
  size: z.number(),
  uploadedAt: z.string(),
  ingestedAt: z.string().optional(),
})
