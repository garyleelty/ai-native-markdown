import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock data structures
type MockSnapshot = {
  id?: number
  filePath: string
  content: string
  timestamp: number
  label: string
  charCount: number
}

let mockSnapshots: Map<number, MockSnapshot> = new Map()
let nextId = 1

// Mock the entire versionHistory module
vi.mock('../versionHistory', () => ({
  versionHistory: {
    saveSnapshot: vi.fn(async (filePath: string, content: string, label?: string) => {
      // Check for duplicate content
      const existing = [...mockSnapshots.values()].filter(s => s.filePath === filePath)
      const last = existing.sort((a, b) => a.timestamp - b.timestamp).pop()
      if (last && last.content === content) {
        return last.id
      }

      // First add the new snapshot
      const newId = nextId++
      const snapshot = {
        id: newId,
        filePath,
        content,
        timestamp: Date.now(),
        label: label || '自动保存',
        charCount: content.length,
      }
      mockSnapshots.set(newId, snapshot)

      // Then delete old snapshots if over limit
      const allForFile = [...mockSnapshots.values()].filter(s => s.filePath === filePath)
      if (allForFile.length > 50) {
        const sorted = allForFile.sort((a, b) => a.timestamp - b.timestamp)
        const toDelete = sorted.slice(0, allForFile.length - 50)
        toDelete.forEach(s => {
          if (s.id) mockSnapshots.delete(s.id)
        })
      }

      return newId
    }),

    getSnapshots: vi.fn(async (filePath: string) => {
      return [...mockSnapshots.values()]
        .filter(s => s.filePath === filePath)
        .sort((a, b) => a.timestamp - b.timestamp)
    }),

    getSnapshot: vi.fn(async (id: number) => {
      return mockSnapshots.get(id)
    }),

    restoreSnapshot: vi.fn(async (id: number) => {
      const snapshot = mockSnapshots.get(id)
      return snapshot?.content || null
    }),

    deleteSnapshot: vi.fn(async (id: number) => {
      mockSnapshots.delete(id)
    }),

    clearHistory: vi.fn(async (filePath: string) => {
      const toDelete = [...mockSnapshots.entries()]
        .filter(([_, s]) => s.filePath === filePath)
        .map(([id, _]) => id)
      toDelete.forEach(id => mockSnapshots.delete(id))
    }),

    clearByPrefix: vi.fn(async (prefix: string) => {
      const toDelete = [...mockSnapshots.entries()]
        .filter(([_, s]) => s.filePath === prefix || s.filePath.startsWith(`${prefix}/`))
        .map(([id, _]) => id)
      toDelete.forEach(id => mockSnapshots.delete(id))
    }),

    renameFile: vi.fn(async (oldPath: string, newPath: string) => {
      for (const [id, snapshot] of mockSnapshots.entries()) {
        if (snapshot.filePath === oldPath) {
          mockSnapshots.set(id, { ...snapshot, filePath: newPath })
        }
      }
    }),

    renameByPrefix: vi.fn(async (oldPrefix: string, newPrefix: string) => {
      for (const [id, snapshot] of mockSnapshots.entries()) {
        if (snapshot.filePath === oldPrefix || snapshot.filePath.startsWith(`${oldPrefix}/`)) {
          const newPath = snapshot.filePath === oldPrefix
            ? newPrefix
            : `${newPrefix}${snapshot.filePath.slice(oldPrefix.length)}`
          mockSnapshots.set(id, { ...snapshot, filePath: newPath })
        }
      }
    }),
  },
}))

import { versionHistory } from '../versionHistory'

describe('versionHistory', () => {
  beforeEach(() => {
    mockSnapshots.clear()
    nextId = 1
    vi.clearAllMocks()
  })

  describe('saveSnapshot', () => {
    it('should save a new snapshot', async () => {
      const id = await versionHistory.saveSnapshot('/test.md', 'hello world')
      expect(id).toBeDefined()

      const snapshot = await versionHistory.getSnapshot(id!)
      expect(snapshot).toBeDefined()
      expect(snapshot?.filePath).toBe('/test.md')
      expect(snapshot?.content).toBe('hello world')
      expect(snapshot?.label).toBe('自动保存')
      expect(snapshot?.charCount).toBe(11)
    })

    it('should use custom label when provided', async () => {
      const id = await versionHistory.saveSnapshot('/test.md', 'test content', '手动保存')
      const snapshot = await versionHistory.getSnapshot(id!)
      expect(snapshot?.label).toBe('手动保存')
    })

    it('should not save duplicate content', async () => {
      const id1 = await versionHistory.saveSnapshot('/test.md', 'same content')
      const id2 = await versionHistory.saveSnapshot('/test.md', 'same content')
      expect(id1).toBe(id2)

      const snapshots = await versionHistory.getSnapshots('/test.md')
      expect(snapshots.length).toBe(1)
    })

    it('should save different content as new snapshot', async () => {
      const id1 = await versionHistory.saveSnapshot('/test.md', 'content 1')
      const id2 = await versionHistory.saveSnapshot('/test.md', 'content 2')
      expect(id1).not.toBe(id2)

      const snapshots = await versionHistory.getSnapshots('/test.md')
      expect(snapshots.length).toBe(2)
    })

    it('should delete old snapshots when exceeding max limit (50)', async () => {
      // Save 51 snapshots
      for (let i = 0; i < 51; i++) {
        await versionHistory.saveSnapshot('/test.md', `content ${i}`)
      }

      const snapshots = await versionHistory.getSnapshots('/test.md')
      expect(snapshots.length).toBe(50)
    })
  })

  describe('getSnapshots', () => {
    it('should return all snapshots for a file', async () => {
      await versionHistory.saveSnapshot('/test.md', 'content 1')
      await versionHistory.saveSnapshot('/test.md', 'content 2')
      await versionHistory.saveSnapshot('/other.md', 'other content')

      const snapshots = await versionHistory.getSnapshots('/test.md')
      expect(snapshots.length).toBe(2)
      expect(snapshots.every(s => s.filePath === '/test.md')).toBe(true)
    })

    it('should return empty array for non-existent file', async () => {
      const snapshots = await versionHistory.getSnapshots('/nonexistent.md')
      expect(snapshots).toEqual([])
    })

    it('should return snapshots sorted by timestamp', async () => {
      await versionHistory.saveSnapshot('/test.md', 'content 1')
      await new Promise(r => setTimeout(r, 5))
      await versionHistory.saveSnapshot('/test.md', 'content 2')
      await new Promise(r => setTimeout(r, 5))
      await versionHistory.saveSnapshot('/test.md', 'content 3')

      const snapshots = await versionHistory.getSnapshots('/test.md')
      expect(snapshots.length).toBe(3)
      expect(snapshots[0]?.content).toBe('content 1')
      expect(snapshots[1]?.content).toBe('content 2')
      expect(snapshots[2]?.content).toBe('content 3')
    })
  })

  describe('getSnapshot', () => {
    it('should return snapshot by id', async () => {
      const id = await versionHistory.saveSnapshot('/test.md', 'hello')
      const snapshot = await versionHistory.getSnapshot(id!)
      expect(snapshot?.content).toBe('hello')
    })

    it('should return undefined for non-existent id', async () => {
      const snapshot = await versionHistory.getSnapshot(99999)
      expect(snapshot).toBeUndefined()
    })
  })

  describe('restoreSnapshot', () => {
    it('should return content of snapshot', async () => {
      const id = await versionHistory.saveSnapshot('/test.md', 'content to restore')
      const content = await versionHistory.restoreSnapshot(id!)
      expect(content).toBe('content to restore')
    })

    it('should return null for non-existent id', async () => {
      const content = await versionHistory.restoreSnapshot(99999)
      expect(content).toBeNull()
    })
  })

  describe('deleteSnapshot', () => {
    it('should delete snapshot by id', async () => {
      const id = await versionHistory.saveSnapshot('/test.md', 'content')
      await versionHistory.deleteSnapshot(id!)

      const snapshot = await versionHistory.getSnapshot(id!)
      expect(snapshot).toBeUndefined()
    })
  })

  describe('clearHistory', () => {
    it('should clear all snapshots for a file', async () => {
      await versionHistory.saveSnapshot('/test.md', 'content 1')
      await versionHistory.saveSnapshot('/test.md', 'content 2')
      await versionHistory.saveSnapshot('/other.md', 'other content')

      await versionHistory.clearHistory('/test.md')

      const testSnapshots = await versionHistory.getSnapshots('/test.md')
      expect(testSnapshots).toEqual([])

      const otherSnapshots = await versionHistory.getSnapshots('/other.md')
      expect(otherSnapshots.length).toBe(1)
    })
  })

  describe('clearByPrefix', () => {
    it('should clear all snapshots with given prefix', async () => {
      await versionHistory.saveSnapshot('/folder/file1.md', 'content 1')
      await versionHistory.saveSnapshot('/folder/file2.md', 'content 2')
      await versionHistory.saveSnapshot('/folder', 'folder content')
      await versionHistory.saveSnapshot('/other/file.md', 'other content')

      await versionHistory.clearByPrefix('/folder')

      const folderSnapshots1 = await versionHistory.getSnapshots('/folder/file1.md')
      const folderSnapshots2 = await versionHistory.getSnapshots('/folder/file2.md')
      const folderSnapshots3 = await versionHistory.getSnapshots('/folder')
      expect(folderSnapshots1).toEqual([])
      expect(folderSnapshots2).toEqual([])
      expect(folderSnapshots3).toEqual([])

      const otherSnapshots = await versionHistory.getSnapshots('/other/file.md')
      expect(otherSnapshots.length).toBe(1)
    })
  })

  describe('renameFile', () => {
    it('should rename a file', async () => {
      await versionHistory.saveSnapshot('/old.md', 'content 1')
      await versionHistory.saveSnapshot('/old.md', 'content 2')

      await versionHistory.renameFile('/old.md', '/new.md')

      const oldSnapshots = await versionHistory.getSnapshots('/old.md')
      expect(oldSnapshots).toEqual([])

      const newSnapshots = await versionHistory.getSnapshots('/new.md')
      expect(newSnapshots.length).toBe(2)
    })
  })

  describe('renameByPrefix', () => {
    it('should rename all files with given prefix', async () => {
      await versionHistory.saveSnapshot('/old/folder/file1.md', 'content 1')
      await versionHistory.saveSnapshot('/old/folder/file2.md', 'content 2')
      await versionHistory.saveSnapshot('/old', 'content 3')
      await versionHistory.saveSnapshot('/other/file.md', 'content 4')

      await versionHistory.renameByPrefix('/old', '/new')

      expect(await versionHistory.getSnapshots('/old/folder/file1.md')).toEqual([])
      expect((await versionHistory.getSnapshots('/old/folder/file2.md')).length).toBe(0)
      expect((await versionHistory.getSnapshots('/old')).length).toBe(0)

      expect((await versionHistory.getSnapshots('/new/folder/file1.md')).length).toBe(1)
      expect((await versionHistory.getSnapshots('/new/folder/file2.md')).length).toBe(1)
      expect((await versionHistory.getSnapshots('/new')).length).toBe(1)
      expect((await versionHistory.getSnapshots('/other/file.md')).length).toBe(1)
    })
  })
})
