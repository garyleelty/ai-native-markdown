import { describe, it, expect, beforeEach, vi, beforeAll, afterAll } from 'vitest'
import 'fake-indexeddb/auto'

// Mock other services first
vi.mock('../knowledgeIndex', () => ({
  knowledgeIndex: {
    markStale: vi.fn(),
    clearStale: vi.fn(),
    isStale: vi.fn(),
    indexFile: vi.fn(),
    removeFile: vi.fn(),
    removeByPrefix: vi.fn(),
    renameFile: vi.fn(),
    renameByPrefix: vi.fn(),
    rebuild: vi.fn(),
    subscribe: vi.fn(),
    getAll: vi.fn(),
    getByPath: vi.fn(),
    getBacklinks: vi.fn(),
    getUnlinkedMentions: vi.fn(),
    buildGraphData: vi.fn(),
    notifyChanged: vi.fn(),
  },
}))

vi.mock('../rag', () => ({
  ragService: {
    deleteByPrefix: vi.fn(),
    renameDocument: vi.fn(),
    renameByPrefix: vi.fn(),
  },
}))

vi.mock('../versionHistory', () => ({
  versionHistory: {
    clearByPrefix: vi.fn(),
    renameFile: vi.fn(),
    renameByPrefix: vi.fn(),
  },
}))

vi.mock('@/utils/wikiLinks', () => ({
  updateWikiLinksForRename: vi.fn((content) => content),
}))

vi.mock('@/utils/pathHelpers', () => ({
  isMarkdownPath: vi.fn((path) => /\.(md|markdown)$/i.test(path)),
  mimeTypeForPath: vi.fn((path) => {
    if (path.endsWith('.png')) return 'image/png'
    if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg'
    return 'text/plain'
  }),
}))

import { fileSystem, _testDb } from '../fileSystem'
import { knowledgeIndex } from '../knowledgeIndex'
import { ragService } from '../rag'
import { versionHistory } from '../versionHistory'

describe('fileSystem', () => {
  const db = _testDb;

  beforeAll(async () => {
    await db.open();
  })

  afterAll(async () => {
    await db.delete();
  })

  beforeEach(async () => {
    await db.files.clear();
    vi.clearAllMocks();
  })

  describe('init', () => {
    it('should create workspace and demo files when database is empty', async () => {
      await fileSystem.init()
      
      const files = await db.files.toArray()
      
      // 检查预期的文件存在即可
      const workspace = files.find(f => f.path === '/workspace')
      expect(workspace).toBeDefined()
      expect(workspace?.isDirectory).toBe(true)
      
      const readme = files.find(f => f.path === '/workspace/README.md')
      expect(readme).toBeDefined()
      expect(readme?.isDirectory).toBe(false)
      
      const notesDir = files.find(f => f.path === '/workspace/notes')
      expect(notesDir).toBeDefined()
      expect(notesDir?.isDirectory).toBe(true)
      
      const researchMap = files.find(f => f.path === '/workspace/notes/Research Map.md')
      expect(researchMap).toBeDefined()
    })

    it('should index demo markdown files in knowledgeIndex when creating them', async () => {
      await fileSystem.init()
      
      // 应该调用知识索引来索引 README.md 和 Research Map.md
      expect(knowledgeIndex.indexFile).toHaveBeenCalledTimes(2)
      expect(knowledgeIndex.indexFile).toHaveBeenCalledWith(
        '/workspace/README.md',
        expect.any(String),
        { silent: true }
      )
      expect(knowledgeIndex.indexFile).toHaveBeenCalledWith(
        '/workspace/notes/Research Map.md',
        expect.any(String),
        { silent: true }
      )
    })

    it('should create workspace if missing but preserve existing files', async () => {
      // 先添加一些现有文件
      await db.files.add({
        path: '/test.md',
        name: 'test.md',
        content: 'test',
        isDirectory: false,
        parentPath: '/',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        size: 4,
      })

      await fileSystem.init()
      
      const files = await db.files.toArray()
      expect(files.some(f => f.path === '/test.md')).toBe(true)
      expect(files.some(f => f.path === '/workspace')).toBe(true)
    })

    it('should convert non-directory workspace to directory', async () => {
      // 添加一个不是目录的 workspace
      await db.files.add({
        path: '/workspace',
        name: 'workspace',
        content: 'old content',
        isDirectory: false,
        parentPath: '/',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        size: 11,
      })

      await fileSystem.init()
      
      const workspace = await db.files.where('path').equals('/workspace').first()
      expect(workspace?.isDirectory).toBe(true)
    })
  })

  describe('readFile', () => {
    it('should read file content', async () => {
      await db.table('files').add({
        path: '/test.md',
        name: 'test.md',
        content: 'hello world',
        isDirectory: false,
        parentPath: '/',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        size: 11,
      })

      const content = await fileSystem.readFile('/test.md')
      expect(content).toBe('hello world')
    })

    it('should throw error if file does not exist', async () => {
      await expect(fileSystem.readFile('/nonexistent.md')).rejects.toThrow('文件不存在')
    })

    it('should throw error if path is directory', async () => {
      await db.table('files').add({
        path: '/folder',
        name: 'folder',
        content: '',
        isDirectory: true,
        parentPath: '/',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        size: 0,
      })

      await expect(fileSystem.readFile('/folder')).rejects.toThrow('路径是文件夹')
    })
  })

  describe('readFileOrEmpty', () => {
    it('should return file content if exists', async () => {
      await db.table('files').add({
        path: '/test.md',
        name: 'test.md',
        content: 'hello world',
        isDirectory: false,
        parentPath: '/',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        size: 11,
      })

      const content = await fileSystem.readFileOrEmpty('/test.md')
      expect(content).toBe('hello world')
    })

    it('should return empty string if file does not exist', async () => {
      const content = await fileSystem.readFileOrEmpty('/nonexistent.md')
      expect(content).toBe('')
    })
  })

  describe('readAsset', () => {
    it('should return content as data URL', async () => {
      await db.table('files').add({
        path: '/image.png',
        name: 'image.png',
        content: 'base64content',
        isDirectory: false,
        parentPath: '/',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        size: 13,
      })

      const dataUrl = await fileSystem.readAsset('/image.png')
      expect(dataUrl).toBe('data:image/png;base64,base64content')
    })
  })

  describe('writeFile', () => {
    it('should create new file if not exists', async () => {
      await db.table('files').add({
        path: '/workspace',
        name: 'workspace',
        content: '',
        isDirectory: true,
        parentPath: '/',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        size: 0,
      })

      await fileSystem.writeFile('/workspace/new.md', 'new content')
      
      const file = await db.table('files').where('path').equals('/workspace/new.md').first()
      expect(file).toBeDefined()
      expect(file?.content).toBe('new content')
    })

    it('should update existing file', async () => {
      await db.table('files').add({
        path: '/workspace',
        name: 'workspace',
        content: '',
        isDirectory: true,
        parentPath: '/',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        size: 0,
      })
      await db.table('files').add({
        path: '/workspace/existing.md',
        name: 'existing.md',
        content: 'old content',
        isDirectory: false,
        parentPath: '/workspace',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        size: 11,
      })

      await fileSystem.writeFile('/workspace/existing.md', 'updated content')
      
      const file = await db.table('files').where('path').equals('/workspace/existing.md').first()
      expect(file?.content).toBe('updated content')
    })

    it('should throw error if parent directory does not exist', async () => {
      await expect(fileSystem.writeFile('/nonexistent/test.md', 'content')).rejects.toThrow('父文件夹不存在')
    })

    it('should throw error if path is directory', async () => {
      await db.table('files').add({
        path: '/folder',
        name: 'folder',
        content: '',
        isDirectory: true,
        parentPath: '/',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        size: 0,
      })

      await expect(fileSystem.writeFile('/folder', 'content')).rejects.toThrow('路径是文件夹')
    })

    it('should call knowledgeIndex.indexFile for markdown files', async () => {
      await db.table('files').add({
        path: '/workspace',
        name: 'workspace',
        content: '',
        isDirectory: true,
        parentPath: '/',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        size: 0,
      })

      await fileSystem.writeFile('/workspace/test.md', 'content')
      
      expect(knowledgeIndex.indexFile).toHaveBeenCalledWith('/workspace/test.md', 'content')
    })

    it('should call knowledgeIndex.removeByPrefix for non-markdown files', async () => {
      await db.table('files').add({
        path: '/workspace',
        name: 'workspace',
        content: '',
        isDirectory: true,
        parentPath: '/',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        size: 0,
      })

      await fileSystem.writeFile('/workspace/test.txt', 'content')
      
      expect(knowledgeIndex.removeByPrefix).toHaveBeenCalledWith('/workspace/test.txt')
    })
  })

  describe('createFile', () => {
    it('should create empty file', async () => {
      await db.table('files').add({
        path: '/workspace',
        name: 'workspace',
        content: '',
        isDirectory: true,
        parentPath: '/',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        size: 0,
      })

      await fileSystem.createFile('/workspace/new.md')
      
      const file = await db.table('files').where('path').equals('/workspace/new.md').first()
      expect(file).toBeDefined()
      expect(file?.content).toBe('')
      expect(file?.isDirectory).toBe(false)
    })

    it('should throw error if path already exists', async () => {
      await db.table('files').add({
        path: '/workspace',
        name: 'workspace',
        content: '',
        isDirectory: true,
        parentPath: '/',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        size: 0,
      })
      await db.table('files').add({
        path: '/workspace/exists.md',
        name: 'exists.md',
        content: 'content',
        isDirectory: false,
        parentPath: '/workspace',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        size: 7,
      })

      await expect(fileSystem.createFile('/workspace/exists.md')).rejects.toThrow('路径已存在')
    })

    it('should throw error if parent directory does not exist', async () => {
      await expect(fileSystem.createFile('/nonexistent/test.md')).rejects.toThrow('父文件夹不存在')
    })
  })

  describe('createDirectory', () => {
    it('should create directory', async () => {
      await db.table('files').add({
        path: '/workspace',
        name: 'workspace',
        content: '',
        isDirectory: true,
        parentPath: '/',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        size: 0,
      })

      await fileSystem.createDirectory('/workspace/newfolder')
      
      const dir = await db.table('files').where('path').equals('/workspace/newfolder').first()
      expect(dir).toBeDefined()
      expect(dir?.isDirectory).toBe(true)
    })

    it('should throw error if path already exists', async () => {
      await db.table('files').add({
        path: '/workspace',
        name: 'workspace',
        content: '',
        isDirectory: true,
        parentPath: '/',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        size: 0,
      })

      await expect(fileSystem.createDirectory('/workspace')).rejects.toThrow('路径已存在')
    })
  })

  describe('deleteFile', () => {
    it('should delete single file', async () => {
      await db.table('files').add({
        path: '/test.md',
        name: 'test.md',
        content: 'content',
        isDirectory: false,
        parentPath: '/',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        size: 7,
      })

      await fileSystem.deleteFile('/test.md')
      
      const file = await db.table('files').where('path').equals('/test.md').first()
      expect(file).toBeUndefined()
    })

    it('should recursively delete directory and children', async () => {
      const now = Date.now()
      await db.table('files').bulkAdd([
        { path: '/folder', name: 'folder', content: '', isDirectory: true, parentPath: '/', createdAt: now, updatedAt: now, size: 0 },
        { path: '/folder/file1.md', name: 'file1.md', content: 'content1', isDirectory: false, parentPath: '/folder', createdAt: now, updatedAt: now, size: 8 },
        { path: '/folder/subfolder', name: 'subfolder', content: '', isDirectory: true, parentPath: '/folder', createdAt: now, updatedAt: now, size: 0 },
        { path: '/folder/subfolder/file2.md', name: 'file2.md', content: 'content2', isDirectory: false, parentPath: '/folder/subfolder', createdAt: now, updatedAt: now, size: 8 },
      ])

      await fileSystem.deleteFile('/folder')
      
      const files = await db.table('files').toArray()
      expect(files.length).toBe(0)
    })

    it('should handle deleting non-existent file', async () => {
      await expect(fileSystem.deleteFile('/nonexistent.md')).resolves.not.toThrow()
    })

    it('should call knowledgeIndex.removeByPrefix', async () => {
      await db.table('files').add({
        path: '/test.md',
        name: 'test.md',
        content: 'content',
        isDirectory: false,
        parentPath: '/',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        size: 7,
      })

      await fileSystem.deleteFile('/test.md')
      
      expect(knowledgeIndex.removeByPrefix).toHaveBeenCalledWith('/test.md')
    })

    it('should call versionHistory.clearByPrefix and ragService.deleteByPrefix', async () => {
      await db.table('files').add({
        path: '/test.md',
        name: 'test.md',
        content: 'content',
        isDirectory: false,
        parentPath: '/',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        size: 7,
      })

      await fileSystem.deleteFile('/test.md')
      
      expect(versionHistory.clearByPrefix).toHaveBeenCalledWith('/test.md')
      expect(ragService.deleteByPrefix).toHaveBeenCalledWith('/test.md')
    })
  })

  describe('renameFile', () => {
    it('should rename single file', async () => {
      await db.table('files').add({
        path: '/old.md',
        name: 'old.md',
        content: 'content',
        isDirectory: false,
        parentPath: '/',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        size: 7,
      })

      const result = await fileSystem.renameFile('/old.md', '/new.md')
      
      expect(result.renamedPaths).toHaveLength(1)
      expect(result.renamedPaths[0].oldPath).toBe('/old.md')
      expect(result.renamedPaths[0].newPath).toBe('/new.md')
      
      const oldFile = await db.table('files').where('path').equals('/old.md').first()
      const newFile = await db.table('files').where('path').equals('/new.md').first()
      
      expect(oldFile).toBeUndefined()
      expect(newFile).toBeDefined()
      expect(newFile?.name).toBe('new.md')
    })

    it('should rename directory and all children', async () => {
      const now = Date.now()
      await db.table('files').bulkAdd([
        { path: '/oldfolder', name: 'oldfolder', content: '', isDirectory: true, parentPath: '/', createdAt: now, updatedAt: now, size: 0 },
        { path: '/oldfolder/file1.md', name: 'file1.md', content: 'content1', isDirectory: false, parentPath: '/oldfolder', createdAt: now, updatedAt: now, size: 8 },
        { path: '/oldfolder/subfolder', name: 'subfolder', content: '', isDirectory: true, parentPath: '/oldfolder', createdAt: now, updatedAt: now, size: 0 },
        { path: '/oldfolder/subfolder/file2.md', name: 'file2.md', content: 'content2', isDirectory: false, parentPath: '/oldfolder/subfolder', createdAt: now, updatedAt: now, size: 8 },
      ])

      const result = await fileSystem.renameFile('/oldfolder', '/newfolder')
      
      expect(result.renamedPaths).toHaveLength(4)
      
      const oldFiles = await db.table('files').filter(f => f.path.startsWith('/oldfolder')).toArray()
      expect(oldFiles.length).toBe(0)
      
      const newFiles = await db.table('files').filter(f => f.path.startsWith('/newfolder')).toArray()
      expect(newFiles.length).toBe(4)
    })

    it('should throw error if file does not exist', async () => {
      await expect(fileSystem.renameFile('/nonexistent.md', '/new.md')).rejects.toThrow('File not found')
    })

    it('should throw error if new path already exists', async () => {
      const now = Date.now()
      await db.table('files').bulkAdd([
        { path: '/old.md', name: 'old.md', content: 'old', isDirectory: false, parentPath: '/', createdAt: now, updatedAt: now, size: 3 },
        { path: '/new.md', name: 'new.md', content: 'new', isDirectory: false, parentPath: '/', createdAt: now, updatedAt: now, size: 3 },
      ])

      await expect(fileSystem.renameFile('/old.md', '/new.md')).rejects.toThrow('路径已存在')
    })

    it('should throw error if moving directory inside itself', async () => {
      await db.table('files').add({
        path: '/folder', name: 'folder', content: '', isDirectory: true, parentPath: '/',
        createdAt: Date.now(), updatedAt: Date.now(), size: 0
      })

      await expect(fileSystem.renameFile('/folder', '/folder/subfolder')).rejects.toThrow('不能将文件夹移动到自身内部')
    })

    it('should return empty result if old and new paths are same', async () => {
      await db.table('files').add({
        path: '/same.md', name: 'same.md', content: 'content', isDirectory: false, parentPath: '/',
        createdAt: Date.now(), updatedAt: Date.now(), size: 7
      })

      const result = await fileSystem.renameFile('/same.md', '/same.md')
      expect(result.renamedPaths).toEqual([])
      expect(result.updatedLinkPaths).toEqual([])
    })

    it('should call knowledgeIndex.renameFile for markdown files', async () => {
      await db.table('files').add({
        path: '/old.md', name: 'old.md', content: 'content', isDirectory: false, parentPath: '/',
        createdAt: Date.now(), updatedAt: Date.now(), size: 7
      })

      await fileSystem.renameFile('/old.md', '/new.md')
      
      expect(knowledgeIndex.renameFile).toHaveBeenCalled()
    })

    it('should call versionHistory and ragService rename functions', async () => {
      await db.table('files').add({
        path: '/old.md', name: 'old.md', content: 'content', isDirectory: false, parentPath: '/',
        createdAt: Date.now(), updatedAt: Date.now(), size: 7
      })

      await fileSystem.renameFile('/old.md', '/new.md')
      
      expect(versionHistory.renameFile).toHaveBeenCalledWith('/old.md', '/new.md')
      expect(ragService.renameDocument).toHaveBeenCalledWith('/old.md', '/new.md')
    })
  })

  describe('readDirectory', () => {
    it('should return children of directory', async () => {
      const now = Date.now()
      await db.table('files').bulkAdd([
        { path: '/folder', name: 'folder', content: '', isDirectory: true, parentPath: '/', createdAt: now, updatedAt: now, size: 0 },
        { path: '/folder/file1.md', name: 'file1.md', content: 'content1', isDirectory: false, parentPath: '/folder', createdAt: now, updatedAt: now, size: 8 },
        { path: '/folder/file2.md', name: 'file2.md', content: 'content2', isDirectory: false, parentPath: '/folder', createdAt: now, updatedAt: now, size: 8 },
      ])

      const children = await fileSystem.readDirectory('/folder')
      expect(children).toHaveLength(2)
      expect(children.map(c => c.path)).toEqual(expect.arrayContaining(['/folder/file1.md', '/folder/file2.md']))
    })

    it('should throw error if directory does not exist', async () => {
      await expect(fileSystem.readDirectory('/nonexistent')).rejects.toThrow('文件夹不存在')
    })

    it('should throw error if path is not directory', async () => {
      await db.table('files').add({
        path: '/file.md', name: 'file.md', content: 'content', isDirectory: false, parentPath: '/',
        createdAt: Date.now(), updatedAt: Date.now(), size: 7
      })

      await expect(fileSystem.readDirectory('/file.md')).rejects.toThrow('路径不是文件夹')
    })

    it('should return children at root when path is /', async () => {
      const now = Date.now()
      await db.table('files').bulkAdd([
        { path: '/file1.md', name: 'file1.md', content: 'content1', isDirectory: false, parentPath: '/', createdAt: now, updatedAt: now, size: 8 },
        { path: '/file2.md', name: 'file2.md', content: 'content2', isDirectory: false, parentPath: '/', createdAt: now, updatedAt: now, size: 8 },
      ])

      const children = await fileSystem.readDirectory('/')
      expect(children).toHaveLength(2)
    })
  })

  describe('searchFiles', () => {
    it('should search content in markdown files', async () => {
      const now = Date.now()
      await db.table('files').bulkAdd([
        { path: '/file1.md', name: 'file1.md', content: 'Hello world, this is a test', isDirectory: false, parentPath: '/', createdAt: now, updatedAt: now, size: 25 },
        { path: '/file2.md', name: 'file2.md', content: 'Another file with different content', isDirectory: false, parentPath: '/', createdAt: now, updatedAt: now, size: 34 },
        { path: '/file.txt', name: 'file.txt', content: 'Should not be searched', isDirectory: false, parentPath: '/', createdAt: now, updatedAt: now, size: 23 },
      ])

      const results = await fileSystem.searchFiles('test')
      expect(results).toHaveLength(1)
      expect(results[0].filePath).toBe('/file1.md')
    })

    it('should be case insensitive', async () => {
      await db.table('files').add({
        path: '/file.md', name: 'file.md', content: 'Hello WORLD', isDirectory: false, parentPath: '/',
        createdAt: Date.now(), updatedAt: Date.now(), size: 11
      })

      const results = await fileSystem.searchFiles('world')
      expect(results).toHaveLength(1)
    })

    it('should return up to limit results', async () => {
      const now = Date.now()
      const files = []
      for (let i = 0; i < 30; i++) {
        files.push({
          path: `/file${i}.md`,
          name: `file${i}.md`,
          content: `test content ${i}`,
          isDirectory: false,
          parentPath: '/',
          createdAt: now,
          updatedAt: now,
          size: 13
        })
      }
      await db.table('files').bulkAdd(files)

      const results = await fileSystem.searchFiles('test', 10)
      expect(results.length).toBeLessThanOrEqual(10)
    })

    it('should return empty array if no matches', async () => {
      await db.table('files').add({
        path: '/file.md', name: 'file.md', content: 'no match here', isDirectory: false, parentPath: '/',
        createdAt: Date.now(), updatedAt: Date.now(), size: 14
      })

      const results = await fileSystem.searchFiles('xyz')
      expect(results).toEqual([])
    })
  })

  describe('getAllMarkdownFiles', () => {
    it('should return all markdown files', async () => {
      const now = Date.now()
      await db.table('files').bulkAdd([
        { path: '/file1.md', name: 'file1.md', content: 'content1', isDirectory: false, parentPath: '/', createdAt: now, updatedAt: now, size: 8 },
        { path: '/file2.markdown', name: 'file2.markdown', content: 'content2', isDirectory: false, parentPath: '/', createdAt: now, updatedAt: now, size: 8 },
        { path: '/file.txt', name: 'file.txt', content: 'content3', isDirectory: false, parentPath: '/', createdAt: now, updatedAt: now, size: 8 },
        { path: '/folder', name: 'folder', content: '', isDirectory: true, parentPath: '/', createdAt: now, updatedAt: now, size: 0 },
      ])

      const files = await fileSystem.getAllMarkdownFiles()
      expect(files).toHaveLength(2)
      expect(files.map(f => f.path)).toEqual(expect.arrayContaining(['/file1.md', '/file2.markdown']))
    })

    it('should return empty array if no markdown files', async () => {
      const now = Date.now()
      await db.table('files').bulkAdd([
        { path: '/file.txt', name: 'file.txt', content: 'content', isDirectory: false, parentPath: '/', createdAt: now, updatedAt: now, size: 7 },
        { path: '/folder', name: 'folder', content: '', isDirectory: true, parentPath: '/', createdAt: now, updatedAt: now, size: 0 },
      ])

      const files = await fileSystem.getAllMarkdownFiles()
      expect(files).toEqual([])
    })
  })
})
