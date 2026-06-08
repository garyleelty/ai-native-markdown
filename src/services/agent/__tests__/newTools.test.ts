import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createNoteTool, appendToNoteTool, deleteNoteTool, moveNoteTool } from '../tools'
import { fileSystem } from '@/services/fileSystem'

vi.mock('@/services/fileSystem')

const mockFileSystem = vi.mocked(fileSystem) as any

describe('New Built-in Tools', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('createNoteTool', () => {
    it('should create a new note successfully', async () => {
      mockFileSystem.readFileOrEmpty.mockResolvedValue('')
      mockFileSystem.writeFile.mockResolvedValue(undefined)

      const result = await createNoteTool.execute({ path: '/new-note.md', content: '# Hello' })
      expect(result.success).toBe(true)
      expect(result.display).toContain('/new-note.md')
      expect(mockFileSystem.writeFile).toHaveBeenCalledWith('/new-note.md', '# Hello')
    })

    it('should return error if file already exists', async () => {
      mockFileSystem.readFileOrEmpty.mockResolvedValue('existing content')

      const result = await createNoteTool.execute({ path: '/existing.md', content: '# New' })
      expect(result.success).toBe(false)
      expect(result.error).toContain('已存在')
    })

    it('should return error if path is missing', async () => {
      const result = await createNoteTool.execute({ content: 'test' })
      expect(result.success).toBe(false)
      expect(result.error).toContain('path')
    })

    it('should return error if content is missing', async () => {
      const result = await createNoteTool.execute({ path: '/test.md' })
      expect(result.success).toBe(false)
      expect(result.error).toContain('content')
    })

    it('should return error if path is empty string', async () => {
      const result = await createNoteTool.execute({ path: '', content: 'test' })
      expect(result.success).toBe(false)
      expect(result.error).toContain('path')
    })

    it('should handle fileSystem errors gracefully', async () => {
      mockFileSystem.readFileOrEmpty.mockResolvedValue('')
      mockFileSystem.writeFile.mockRejectedValue(new Error('Write error'))

      const result = await createNoteTool.execute({ path: '/test.md', content: 'test' })
      expect(result.success).toBe(false)
      expect(result.error).toContain('Write error')
    })
  })

  describe('appendToNoteTool', () => {
    it('should append content to existing note', async () => {
      mockFileSystem.readFileOrEmpty.mockResolvedValue('# Existing')
      mockFileSystem.writeFile.mockResolvedValue(undefined)

      const result = await appendToNoteTool.execute({ path: '/test.md', content: '## New Section' })
      expect(result.success).toBe(true)
      expect(result.display).toContain('/test.md')
      expect(mockFileSystem.writeFile).toHaveBeenCalledWith('/test.md', '# Existing\n## New Section')
    })

    it('should add newline separator when existing content does not end with one', async () => {
      mockFileSystem.readFileOrEmpty.mockResolvedValue('# Existing')
      mockFileSystem.writeFile.mockResolvedValue(undefined)

      await appendToNoteTool.execute({ path: '/test.md', content: '## New' })
      expect(mockFileSystem.writeFile).toHaveBeenCalledWith('/test.md', '# Existing\n## New')
    })

    it('should not add extra newline when existing content ends with one', async () => {
      mockFileSystem.readFileOrEmpty.mockResolvedValue('# Existing\n')
      mockFileSystem.writeFile.mockResolvedValue(undefined)

      await appendToNoteTool.execute({ path: '/test.md', content: '## New' })
      expect(mockFileSystem.writeFile).toHaveBeenCalledWith('/test.md', '# Existing\n## New')
    })

    it('should append to empty file', async () => {
      mockFileSystem.readFileOrEmpty.mockResolvedValue('')
      mockFileSystem.writeFile.mockResolvedValue(undefined)

      const result = await appendToNoteTool.execute({ path: '/test.md', content: '# Hello' })
      expect(result.success).toBe(true)
      expect(mockFileSystem.writeFile).toHaveBeenCalledWith('/test.md', '# Hello')
    })

    it('should return error if path is missing', async () => {
      const result = await appendToNoteTool.execute({ content: 'test' })
      expect(result.success).toBe(false)
      expect(result.error).toContain('path')
    })

    it('should return error if content is missing', async () => {
      const result = await appendToNoteTool.execute({ path: '/test.md' })
      expect(result.success).toBe(false)
      expect(result.error).toContain('content')
    })

    it('should handle fileSystem errors gracefully', async () => {
      mockFileSystem.readFileOrEmpty.mockRejectedValue(new Error('Read error'))

      const result = await appendToNoteTool.execute({ path: '/test.md', content: 'test' })
      expect(result.success).toBe(false)
      expect(result.error).toContain('Read error')
    })
  })

  describe('deleteNoteTool', () => {
    it('should delete a note successfully', async () => {
      mockFileSystem.readFileOrEmpty.mockResolvedValue('# Content to delete')
      mockFileSystem.deleteFile.mockResolvedValue(undefined)

      const result = await deleteNoteTool.execute({ path: '/test.md' })
      expect(result.success).toBe(true)
      expect(result.display).toContain('/test.md')
      expect(mockFileSystem.deleteFile).toHaveBeenCalledWith('/test.md')
    })

    it('should return error if path is missing', async () => {
      const result = await deleteNoteTool.execute({})
      expect(result.success).toBe(false)
      expect(result.error).toContain('path')
    })

    it('should return error if path is empty string', async () => {
      const result = await deleteNoteTool.execute({ path: '' })
      expect(result.success).toBe(false)
      expect(result.error).toContain('path')
    })

    it('should handle fileSystem errors gracefully', async () => {
      mockFileSystem.readFileOrEmpty.mockResolvedValue('# Content')
      mockFileSystem.deleteFile.mockRejectedValue(new Error('Delete error'))

      const result = await deleteNoteTool.execute({ path: '/test.md' })
      expect(result.success).toBe(false)
      expect(result.error).toContain('Delete error')
    })
  })

  describe('moveNoteTool', () => {
    it('should move a note successfully', async () => {
      mockFileSystem.renameFile.mockResolvedValue({ renamedPaths: [{ oldPath: '/old.md', newPath: '/new.md' }] })

      const result = await moveNoteTool.execute({ old_path: '/old.md', new_path: '/new.md' })
      expect(result.success).toBe(true)
      expect(result.display).toContain('/old.md')
      expect(result.display).toContain('/new.md')
      expect(mockFileSystem.renameFile).toHaveBeenCalledWith('/old.md', '/new.md')
    })

    it('should return error if old_path is missing', async () => {
      const result = await moveNoteTool.execute({ new_path: '/new.md' })
      expect(result.success).toBe(false)
      expect(result.error).toContain('old_path')
    })

    it('should return error if new_path is missing', async () => {
      const result = await moveNoteTool.execute({ old_path: '/old.md' })
      expect(result.success).toBe(false)
      expect(result.error).toContain('new_path')
    })

    it('should return error if old_path and new_path are the same', async () => {
      const result = await moveNoteTool.execute({ old_path: '/same.md', new_path: '/same.md' })
      expect(result.success).toBe(false)
      expect(result.error).toContain('不能相同')
    })

    it('should handle fileSystem errors gracefully', async () => {
      mockFileSystem.renameFile.mockRejectedValue(new Error('Rename error'))

      const result = await moveNoteTool.execute({ old_path: '/old.md', new_path: '/new.md' })
      expect(result.success).toBe(false)
      expect(result.error).toContain('Rename error')
    })
  })
})
