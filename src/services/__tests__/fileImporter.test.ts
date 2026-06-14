import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockWriteFile, mockReadFile } = vi.hoisted(() => ({
  mockWriteFile: vi.fn().mockResolvedValue(undefined),
  mockReadFile: vi.fn().mockResolvedValue('mock content'),
}))

vi.mock('@/services/vault', () => ({
  vaultService: {
    writeFile: mockWriteFile,
    readFile: mockReadFile,
  }
}))

vi.mock('@/services/knowledgeIndex', () => ({
  knowledgeIndex: {}
}))

vi.mock('@/services/pdf', () => ({
  extractTextFromPDF: vi.fn().mockResolvedValue('Extracted PDF text')
}))

vi.mock('@/services/ocr', () => ({
  extractTextFromImage: vi.fn().mockResolvedValue('Extracted OCR text')
}))

vi.mock('@/utils/pathHelpers', () => ({
  isMarkdownPath: vi.fn((p: string) => p.endsWith('.md'))
}))

import { importFile, importExternalFile, importFiles } from '../fileImporter'

describe('fileImporter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWriteFile.mockResolvedValue(undefined)
    mockReadFile.mockResolvedValue('mock content')
  })

  describe('importFile - unsupported types', () => {
    it('should reject unsupported file types', async () => {
      const file = new File(['data'], 'archive.zip', { type: 'application/zip' })
      const result = await importFile(file, '/workspace')
      expect(result.success).toBe(false)
      expect(result.message).toContain('不支持')
    })

    it('should reject files without extension', async () => {
      const file = new File(['data'], 'Makefile', { type: 'text/plain' })
      const result = await importFile(file, '/workspace')
      expect(result.success).toBe(false)
    })
  })

  describe('importFile - markdown', () => {
    it('should import .md files', async () => {
      const file = new File(['# Hello World'], 'note.md', { type: 'text/markdown' })
      const result = await importFile(file, '/workspace')
      expect(result.success).toBe(true)
      expect(result.notePath).toBe('/workspace/note.md')
      expect(mockWriteFile).toHaveBeenCalledWith('/workspace/note.md', '# Hello World')
    })

    it('should import .markdown files', async () => {
      const file = new File(['content'], 'doc.markdown', { type: 'text/markdown' })
      const result = await importFile(file, '/workspace')
      expect(result.success).toBe(true)
      expect(result.notePath).toBe('/workspace/doc.markdown')
    })
  })

  describe('importFile - text', () => {
    it('should import .txt files as markdown with frontmatter', async () => {
      const file = new File(['Plain text content'], 'notes.txt', { type: 'text/plain' })
      const result = await importFile(file, '/workspace')
      expect(result.success).toBe(true)
      expect(result.notePath).toBe('/workspace/notes.md')

      const writtenContent = mockWriteFile.mock.calls[0][1] as string
      expect(writtenContent).toContain('title: notes')
      expect(writtenContent).toContain('type: text-import')
      expect(writtenContent).toContain('Plain text content')
    })
  })

  describe('importFile - PDF', () => {
    it('should import .pdf files with extracted text', async () => {
      const { extractTextFromPDF } = await import('@/services/pdf')
      ;(extractTextFromPDF as any).mockResolvedValueOnce('PDF content here')

      const file = new File([new ArrayBuffer(8)], 'report.pdf', { type: 'application/pdf' })
      const result = await importFile(file, '/workspace')
      expect(result.success).toBe(true)
      expect(result.notePath).toBe('/workspace/report.md')

      const writtenContent = mockWriteFile.mock.calls[0][1] as string
      expect(writtenContent).toContain('type: pdf-import')
      expect(writtenContent).toContain('PDF content here')
    })

    it('should handle PDF with no extractable text', async () => {
      const { extractTextFromPDF } = await import('@/services/pdf')
      ;(extractTextFromPDF as any).mockResolvedValueOnce('')

      const file = new File([new ArrayBuffer(8)], 'scanned.pdf', { type: 'application/pdf' })
      const result = await importFile(file, '/workspace')
      expect(result.success).toBe(true)

      const writtenContent = mockWriteFile.mock.calls[0][1] as string
      expect(writtenContent).toContain('无法提取文本内容')
    })

    it('should truncate long PDF text in summary', async () => {
      const { extractTextFromPDF } = await import('@/services/pdf')
      ;(extractTextFromPDF as any).mockResolvedValueOnce('A'.repeat(600))

      const file = new File([new ArrayBuffer(8)], 'long.pdf', { type: 'application/pdf' })
      const result = await importFile(file, '/workspace')
      expect(result.success).toBe(true)

      const writtenContent = mockWriteFile.mock.calls[0][1] as string
      const summarySection = writtenContent.split('## 内容摘要')[1]?.split('---')[0]
      expect(summarySection).toContain('...')
    })
  })

  describe('importFile - image', () => {
    it('should import .png files with OCR text', async () => {
      const { extractTextFromImage } = await import('@/services/ocr')
      ;(extractTextFromImage as any).mockResolvedValueOnce('Recognized text')

      const file = new File([new ArrayBuffer(8)], 'photo.png', { type: 'image/png' })
      const result = await importFile(file, '/workspace')
      expect(result.success).toBe(true)
      expect(result.notePath).toBe('/workspace/photo.md')

      const writtenContent = mockWriteFile.mock.calls[0][1] as string
      expect(writtenContent).toContain('type: image-import')
      expect(writtenContent).toContain('Recognized text')
    })

    it('should import image without OCR text', async () => {
      const { extractTextFromImage } = await import('@/services/ocr')
      ;(extractTextFromImage as any).mockResolvedValueOnce('')

      const file = new File([new ArrayBuffer(8)], 'photo.jpg', { type: 'image/jpeg' })
      const result = await importFile(file, '/workspace')
      expect(result.success).toBe(true)

      const writtenContent = mockWriteFile.mock.calls[0][1] as string
      expect(writtenContent).toContain('无法提取文字内容')
    })

    it('should support various image formats', async () => {
      const { extractTextFromImage } = await import('@/services/ocr')
      ;(extractTextFromImage as any).mockResolvedValue('')

      for (const name of ['test.gif', 'test.webp', 'test.bmp']) {
        const file = new File([new ArrayBuffer(8)], name, { type: 'image/unknown' })
        const result = await importFile(file, '/workspace')
        expect(result.success).toBe(true)
      }
    })
  })

  describe('importFile - error handling', () => {
    it('should handle vaultService.writeFile errors', async () => {
      mockWriteFile.mockRejectedValueOnce(new Error('Disk full'))

      const file = new File(['content'], 'note.md', { type: 'text/markdown' })
      const result = await importFile(file, '/workspace')
      expect(result.success).toBe(false)
      expect(result.message).toContain('导入失败')
    })
  })

  describe('importExternalFile', () => {
    it('should reject unsupported file types', async () => {
      const result = await importExternalFile('/path/to/archive.zip')
      expect(result.success).toBe(false)
    })

    it('should import external markdown files', async () => {
      mockReadFile.mockResolvedValueOnce('# External Note')
      const result = await importExternalFile('/external/note.md', '/workspace')
      expect(result.success).toBe(true)
      expect(result.notePath).toBe('/workspace/note.md')
    })

    it('should import external text files with frontmatter', async () => {
      mockReadFile.mockResolvedValueOnce('Text content')
      const result = await importExternalFile('/external/readme.txt', '/workspace')
      expect(result.success).toBe(true)

      const writtenContent = mockWriteFile.mock.calls[0][1] as string
      expect(writtenContent).toContain('source: /external/readme.txt')
      expect(writtenContent).toContain('type: text-import')
    })

    it('should use /workspace as default root path when noteRootPath is empty', async () => {
      mockReadFile.mockResolvedValueOnce('content')
      const result = await importExternalFile('/external/note.md', '')
      expect(result.success).toBe(true)
      expect(result.notePath).toContain('/workspace/')
    })

    it('should use /workspace as default root path when noteRootPath is undefined', async () => {
      mockReadFile.mockResolvedValueOnce('content')
      const result = await importExternalFile('/external/note.md')
      expect(result.success).toBe(true)
      expect(result.notePath).toContain('/workspace/')
    })

    it('should handle readFile errors', async () => {
      mockReadFile.mockRejectedValueOnce(new Error('File not found'))
      const result = await importExternalFile('/missing/file.md')
      expect(result.success).toBe(false)
      expect(result.message).toContain('导入失败')
    })
  })

  describe('importFiles - batch import', () => {
    it('should import multiple files and report success/failure counts', async () => {
      const files = [
        new File(['# Note 1'], 'a.md', { type: 'text/markdown' }),
        new File(['Text'], 'b.txt', { type: 'text/plain' }),
        new File(['data'], 'c.zip', { type: 'application/zip' }),
      ]

      const result = await importFiles(files, '/workspace')
      expect(result.success).toBe(2)
      expect(result.failed).toBe(1)
      expect(result.results).toHaveLength(3)
    })

    it('should handle all files failing', async () => {
      const files = [
        new File(['data'], 'a.zip', { type: 'application/zip' }),
      ]

      const result = await importFiles(files, '/workspace')
      expect(result.success).toBe(0)
      expect(result.failed).toBe(1)
    })

    it('should handle empty file list', async () => {
      const result = await importFiles([], '/workspace')
      expect(result.success).toBe(0)
      expect(result.failed).toBe(0)
      expect(result.results).toEqual([])
    })
  })

  describe('importFile - file already exists', () => {
    it('should return error when markdown file already exists', async () => {
      mockWriteFile.mockRejectedValueOnce(new Error('File already exists'))

      const file = new File(['content'], 'existing.md', { type: 'text/markdown' })
      const result = await importFile(file, '/workspace')
      expect(result.success).toBe(false)
      expect(result.message).toContain('已存在')
    })

    it('should return error when text file target .md already exists', async () => {
      mockWriteFile.mockRejectedValueOnce(new Error('already exists in store'))

      const file = new File(['content'], 'notes.txt', { type: 'text/plain' })
      const result = await importFile(file, '/workspace')
      expect(result.success).toBe(false)
      expect(result.message).toContain('已存在')
    })

    it('should return error when PDF target .md already exists (ConstraintError)', async () => {
      const { extractTextFromPDF } = await import('@/services/pdf')
      ;(extractTextFromPDF as any).mockResolvedValueOnce('PDF text')

      const error = new Error()
      error.name = 'ConstraintError'
      mockWriteFile.mockRejectedValueOnce(error)

      const file = new File([new ArrayBuffer(8)], 'report.pdf', { type: 'application/pdf' })
      const result = await importFile(file, '/workspace')
      expect(result.success).toBe(false)
      expect(result.message).toContain('已存在')
    })

    it('should return error when image target .md already exists', async () => {
      const { extractTextFromImage } = await import('@/services/ocr')
      ;(extractTextFromImage as any).mockResolvedValueOnce('OCR text')

      mockWriteFile.mockRejectedValueOnce(new Error('already exists'))

      const file = new File([new ArrayBuffer(8)], 'photo.png', { type: 'image/png' })
      const result = await importFile(file, '/workspace')
      expect(result.success).toBe(false)
      expect(result.message).toContain('已存在')
    })

    it('should propagate non-existence write errors', async () => {
      mockWriteFile.mockRejectedValueOnce(new Error('Permission denied'))

      const file = new File(['content'], 'note.md', { type: 'text/markdown' })
      const result = await importFile(file, '/workspace')
      expect(result.success).toBe(false)
      expect(result.message).toContain('导入失败')
    })
  })

  describe('importExternalFile - extended types', () => {
    it('should import external PDF files', async () => {
      mockReadFile.mockResolvedValueOnce('PDF content')

      const result = await importExternalFile('/docs/report.pdf', '/workspace')
      expect(result.success).toBe(true)
      expect(result.notePath).toBe('/workspace/report.md')
    })

    it('should import external image files', async () => {
      mockReadFile.mockResolvedValueOnce('OCR text')

      const result = await importExternalFile('/images/photo.jpg', '/workspace')
      expect(result.success).toBe(true)
      expect(result.notePath).toBe('/workspace/photo.md')
    })

    it('should handle file with uppercase extension', async () => {
      mockReadFile.mockResolvedValueOnce('# Note')
      const result = await importExternalFile('/external/NOTE.MD', '/workspace')
      expect(result.success).toBe(true)
    })
  })
})
