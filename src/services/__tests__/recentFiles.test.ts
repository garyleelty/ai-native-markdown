import { beforeEach, describe, expect, it, vi } from 'vitest'
import { recentFilesService, RECENT_FILES_STORAGE_KEY } from '../recentFiles'
import { safeStorage } from '@/utils/security'
import { vaultService } from '@/services/vault'

vi.mock('@/services/vault', () => ({
  vaultService: {
    readFile: vi.fn(),
  },
}))

// Mock localStorage for jsdom environment
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
    get length() { return Object.keys(store).length },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  }
})()

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, configurable: true })

describe('recentFilesService', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  it('normalizes and limits stored recent files', () => {
    safeStorage.set(RECENT_FILES_STORAGE_KEY, [
      { name: 'A.md', path: '/vault/A.md' },
      { name: '', path: '' },
      { name: 'MissingPath.md', path: '' },
      { name: 'B.md', path: '/vault/B.md' },
    ])

    expect(recentFilesService.loadRecentFiles()).toEqual([
      { name: 'A.md', path: '/vault/A.md' },
      { name: 'B.md', path: '/vault/B.md' },
    ])
  })

  it('adds a file to the top and removes duplicates', () => {
    safeStorage.set(RECENT_FILES_STORAGE_KEY, [
      { name: 'Old.md', path: '/vault/Old.md' },
      { name: 'Note.md', path: '/vault/Note.md' },
    ])

    const files = recentFilesService.addRecentFile('/vault/Note.md')

    expect(files).toEqual([
      { name: 'Note.md', path: '/vault/Note.md' },
      { name: 'Old.md', path: '/vault/Old.md' },
    ])
    expect(safeStorage.get(RECENT_FILES_STORAGE_KEY, [])).toEqual(files)
  })

  it('removes a file from the recent list', () => {
    safeStorage.set(RECENT_FILES_STORAGE_KEY, [
      { name: 'A.md', path: '/vault/A.md' },
      { name: 'B.md', path: '/vault/B.md' },
    ])

    const files = recentFilesService.removeRecentFile('/vault/A.md')

    expect(files).toEqual([{ name: 'B.md', path: '/vault/B.md' }])
    expect(safeStorage.get(RECENT_FILES_STORAGE_KEY, [])).toEqual(files)
  })

  it('validates stored recent files and persists only readable markdown files', async () => {
    safeStorage.set(RECENT_FILES_STORAGE_KEY, [
      { name: 'Keep.md', path: '/vault/Keep.md' },
      { name: 'Drop.md', path: '/vault/Drop.md' },
      { name: 'Keep2.md', path: '/vault/Keep2.md' },
    ])
    vi.mocked(vaultService.readFile).mockImplementation(async (path: string) => {
      if (path.includes('Drop')) throw new Error('missing')
      return '# ok'
    })

    const files = await recentFilesService.validateRecentFiles()

    expect(files).toEqual([
      { name: 'Keep.md', path: '/vault/Keep.md' },
      { name: 'Keep2.md', path: '/vault/Keep2.md' },
    ])
    expect(safeStorage.get(RECENT_FILES_STORAGE_KEY, [])).toEqual(files)
  })
})
