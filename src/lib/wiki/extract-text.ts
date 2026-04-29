import { readFile } from "fs/promises"
import { extname } from "path"

/**
 * 从文件中提取纯文本内容
 * 支持: txt, md, csv, json, pdf, xlsx/xls, docx
 */
export async function extractText(filePath: string): Promise<{ text: string; error?: string }> {
  const ext = extname(filePath).toLowerCase()

  try {
    switch (ext) {
      case ".txt":
      case ".md":
      case ".csv":
      case ".json":
        return { text: await readFile(filePath, "utf-8") }

      case ".pdf":
        return await extractPdf(filePath)

      case ".xlsx":
      case ".xls":
        return await extractExcel(filePath)

      case ".docx":
        return await extractDocx(filePath)

      default:
        // 尝试作为纯文本读取
        return { text: await readFile(filePath, "utf-8") }
    }
  } catch (err) {
    return { text: "", error: `文件解析失败: ${err instanceof Error ? err.message : String(err)}` }
  }
}

async function extractPdf(filePath: string): Promise<{ text: string; error?: string }> {
  try {
    const pdfParse = (await import("pdf-parse")).default
    const buffer = await readFile(filePath)
    const data = await pdfParse(buffer)
    return { text: data.text }
  } catch (err) {
    return { text: "", error: `PDF 解析失败: ${err instanceof Error ? err.message : String(err)}` }
  }
}

async function extractExcel(filePath: string): Promise<{ text: string; error?: string }> {
  try {
    const XLSX = await import("xlsx")
    const buffer = await readFile(filePath)
    const workbook = XLSX.read(buffer, { type: "buffer" })

    const lines: string[] = []
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName]
      if (!sheet) continue

      lines.push(`## Sheet: ${sheetName}`)
      const csv = XLSX.utils.sheet_to_csv(sheet)
      lines.push(csv)
      lines.push("")
    }

    return { text: lines.join("\n") }
  } catch (err) {
    return {
      text: "",
      error: `Excel 解析失败: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

async function extractDocx(filePath: string): Promise<{ text: string; error?: string }> {
  // 简易 docx 提取：docx 是 zip 格式，里面 word/document.xml 包含文本
  try {
    const JSZip = (await import("jszip")).default
    const buffer = await readFile(filePath)
    const zip = await JSZip.loadAsync(buffer)
    const docXml = await zip.file("word/document.xml")?.async("string")

    if (!docXml) {
      return { text: "", error: "无法读取 docx 内容" }
    }

    // 提取 <w:t> 标签中的文本
    const text = docXml
      .replace(/<w:p[^>]*>/g, "\n") // 段落换行
      .replace(/<[^>]+>/g, "") // 去除所有 XML 标签
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/\n{3,}/g, "\n\n") // 压缩多余空行
      .trim()

    return { text }
  } catch (err) {
    return { text: "", error: `DOCX 解析失败: ${err instanceof Error ? err.message : String(err)}` }
  }
}
