/**
 * 文件导入服务
 * 支持多种文件格式导入，自动创建关联笔记
 */
import { vaultService } from './vault'
import { knowledgeIndex } from './knowledgeIndex'
import { extractTextFromPDF } from './pdf'
import { extractTextFromImage } from './ocr'
import { isMarkdownPath } from '@/utils/pathHelpers'

export interface ImportResult {
  success: boolean
  filePath?: string
  notePath?: string
  message?: string
}

// 支持的文件类型和对应的 MIME 类型
const SUPPORTED_TYPES = {
  // Markdown
  '.md': 'markdown',
  '.markdown': 'markdown',
  // 文本
  '.txt': 'text',
  // PDF
  '.pdf': 'pdf',
  // 图片（支持 OCR）
  '.png': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.gif': 'image',
  '.webp': 'image',
  '.bmp': 'image',
}

function getFileType(fileName: string): string | null {
  const ext = fileName.toLowerCase().match(/\.[^.]+$/)?.[0]
  return ext ? (SUPPORTED_TYPES as Record<string, string>)[ext] || null : null
}

function getFileExtension(fileName: string): string {
  return fileName.toLowerCase().match(/\.[^.]+$/)?.[0] || ''
}

/**
 * 导入浏览器 File 对象
 */
export async function importFile(
  file: File,
  rootPath: string
): Promise<ImportResult> {
  const fileType = getFileType(file.name)

  if (!fileType) {
    return { success: false, message: `不支持的文件类型: ${file.name}` }
  }

  try {
    switch (fileType) {
      case 'markdown':
        return await importMarkdown(file, rootPath)
      case 'text':
        return await importText(file, rootPath)
      case 'pdf':
        return await importPDF(file, rootPath)
      case 'image':
        return await importImage(file, rootPath)
      default:
        return { success: false, message: `不支持的文件类型: ${file.name}` }
    }
  } catch (e) {
    console.error(`Import failed for ${file.name}:`, e)
    return { success: false, message: `导入失败: ${file.name}` }
  }
}

/**
 * 导入外部文件路径（通过 vaultService 读取）
 */
export async function importExternalFile(filePath: string, noteRootPath?: string): Promise<ImportResult> {
  const fileType = getFileType(filePath)

  if (!fileType) {
    return { success: false, message: `不支持的文件类型: ${filePath}` }
  }

  try {
    // 读取文件内容
    const content = await vaultService.readFile(filePath)

    // 获取文件名
    const fileName = filePath.split('/').pop() || 'unknown'
    const targetPath = noteRootPath || '/workspace'

    switch (fileType) {
      case 'markdown':
        return await importMarkdownContent(fileName, content, filePath, targetPath)
      case 'text':
        return await importTextContent(fileName, content, filePath, targetPath)
      case 'pdf':
        return await importPDFContent(fileName, content, filePath, undefined, targetPath)
      case 'image':
        return await importImageContent(fileName, content, filePath, undefined, targetPath)
      default:
        return { success: false, message: `不支持的文件类型: ${fileName}` }
    }
  } catch (e) {
    console.error(`Import external file failed: ${filePath}`, e)
    return { success: false, message: `导入失败: ${filePath}` }
  }
}

/**
 * 导入 Markdown 文件
 */
async function importMarkdown(file: File, rootPath: string): Promise<ImportResult> {
  const content = await file.text()
  return importMarkdownContent(file.name, content, rootPath, rootPath)
}

async function importMarkdownContent(
  fileName: string,
  content: string,
  sourcePath: string,
  noteRootPath: string
): Promise<ImportResult> {
  // 直接将 Markdown 内容保存为 .md 文件
  const notePath = `${noteRootPath}/${fileName}`
  await vaultService.writeFile(notePath, content)

  return {
    success: true,
    filePath: sourcePath,
    notePath,
    message: `已导入 Markdown: ${fileName}`,
  }
}

/**
 * 导入纯文本文件
 */
async function importText(file: File, rootPath: string): Promise<ImportResult> {
  const content = await file.text()
  return importTextContent(file.name, content, rootPath, rootPath)
}

async function importTextContent(
  fileName: string,
  content: string,
  sourcePath: string,
  noteRootPath: string
): Promise<ImportResult> {
  // 将文本内容包装为 Markdown 格式
  const baseName = fileName.replace(/\.txt$/i, '')
  const markdownContent = [
    `---`,
    `title: ${baseName}`,
    `source: ${sourcePath}`,
    `type: text-import`,
    `created: ${new Date().toISOString()}`,
    `---`,
    '',
    `# ${baseName}`,
    '',
    content,
  ].join('\n')

  const notePath = `${noteRootPath}/${baseName}.md`
  await vaultService.writeFile(notePath, markdownContent)

  return {
    success: true,
    filePath: sourcePath,
    notePath,
    message: `已导入文本并创建笔记: ${baseName}`,
  }
}

/**
 * 导入 PDF 文件（自动 OCR）
 */
async function importPDF(file: File, rootPath: string): Promise<ImportResult> {
  const arrayBuffer = await file.arrayBuffer()
  const text = await extractTextFromPDF(arrayBuffer)
  return importPDFContent(file.name, text, rootPath, arrayBuffer, rootPath)
}

async function importPDFContent(
  fileName: string,
  text: string,
  sourcePath: string,
  _arrayBuffer: ArrayBuffer | undefined,
  noteRootPath: string
): Promise<ImportResult> {
  const baseName = fileName.replace(/\.pdf$/i, '')
  const pageCount = text ? (text.match(/\n\n/g)?.length || 1) : 0

  // 创建笔记内容
  const markdownContent = [
    `---`,
    `title: ${baseName}`,
    `source: ${sourcePath}`,
    `type: pdf-import`,
    `created: ${new Date().toISOString()}`,
    `tags:`,
    `  - PDF`,
    `  - 文档`,
    `---`,
    '',
    `# ${baseName}`,
    '',
    text ? [
      '## 内容摘要',
      '',
      text.slice(0, 500) + (text.length > 500 ? '...' : ''),
      '',
      '---',
      '',
      '## 完整内容',
      '',
      text,
    ].join('\n') : [
      '> 此 PDF 无法提取文本内容，请查看原始文件。',
    ].join('\n'),
    '',
    '---',
    `> 📄 原始文件: ${sourcePath}`,
  ].join('\n')

  const notePath = `${noteRootPath}/${baseName}.md`
  await vaultService.writeFile(notePath, markdownContent)

  return {
    success: true,
    filePath: sourcePath,
    notePath,
    message: `已导入 PDF 并创建笔记: ${baseName} (${pageCount} 页)`,
  }
}

/**
 * 导入图片文件（自动 OCR）
 */
async function importImage(file: File, rootPath: string): Promise<ImportResult> {
  const imageUrl = URL.createObjectURL(file)
  const text = await extractTextFromImage(imageUrl)
  URL.revokeObjectURL(imageUrl)

  return importImageContent(file.name, text, rootPath, await file.arrayBuffer(), rootPath)
}

async function importImageContent(
  fileName: string,
  extractedText: string | null,
  sourcePath: string,
  _arrayBuffer: ArrayBuffer | undefined,
  noteRootPath: string
): Promise<ImportResult> {
  const baseName = fileName.replace(/\.[^.]+$/, '')
  const ext = getFileExtension(fileName)
  const hasOCR = extractedText && extractedText.trim().length > 0

  // 创建笔记内容
  const markdownContent = [
    `---`,
    `title: ${baseName}`,
    `source: ${sourcePath}`,
    `type: image-import`,
    `created: ${new Date().toISOString()}`,
    `tags:`,
    `  - 图片`,
    `  - OCR`,
    `---`,
    '',
    `# ${baseName}`,
    '',
    `![${baseName}](${sourcePath})`,
    '',
    hasOCR ? [
      '## OCR 识别内容',
      '',
      '```',
      extractedText,
      '```',
    ].join('\n') : [
      '> 此图片无法提取文字内容。',
    ].join('\n'),
    '',
    '---',
    `> 🖼 原始图片: ${sourcePath}`,
  ].join('\n')

  const notePath = `${noteRootPath}/${baseName}.md`
  await vaultService.writeFile(notePath, markdownContent)

  return {
    success: true,
    filePath: sourcePath,
    notePath,
    message: hasOCR
      ? `已导入图片并识别文字: ${baseName}`
      : `已导入图片: ${baseName}`,
  }
}

/**
 * 批量导入文件
 */
export async function importFiles(
  files: File[],
  rootPath: string
): Promise<{ success: number; failed: number; results: ImportResult[] }> {
  const results: ImportResult[] = []
  let success = 0
  let failed = 0

  for (const file of files) {
    const result = await importFile(file, rootPath)
    results.push(result)
    if (result.success) {
      success++
    } else {
      failed++
    }
  }

  return { success, failed, results }
}

export const fileImporter = {
  importFile,
  importExternalFile,
  importFiles,
}
