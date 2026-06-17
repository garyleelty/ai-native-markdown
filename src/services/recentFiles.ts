import { vaultService } from '@/services/vault'
import { safeStorage } from '@/utils/security'

export interface RecentFileEntry {
  name: string
  path: string
}

export const RECENT_FILES_STORAGE_KEY = 'recent_files'
const MAX_RECENT_FILES = 10

function nameFromPath(path: string): string {
  return path.split('/').filter(Boolean).pop() || path
}

function normalizeRecentFiles(value: unknown): RecentFileEntry[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const normalized: RecentFileEntry[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const path = typeof (item as RecentFileEntry).path === 'string' ? (item as RecentFileEntry).path : ''
    if (!path || seen.has(path)) continue
    const storedName = typeof (item as RecentFileEntry).name === 'string' ? (item as RecentFileEntry).name : ''
    const name = storedName || nameFromPath(path)
    if (!name) continue
    seen.add(path)
    normalized.push({ name, path })
    if (normalized.length >= MAX_RECENT_FILES) break
  }
  return normalized
}

function persist(files: RecentFileEntry[]): void {
  safeStorage.set(RECENT_FILES_STORAGE_KEY, files.slice(0, MAX_RECENT_FILES))
}

export const recentFilesService = {
  loadRecentFiles(): RecentFileEntry[] {
    return normalizeRecentFiles(safeStorage.get<RecentFileEntry[]>(RECENT_FILES_STORAGE_KEY, []))
  },

  addRecentFile(path: string): RecentFileEntry[] {
    if (!path) return this.loadRecentFiles()
    const next = normalizeRecentFiles([
      { name: nameFromPath(path), path },
      ...this.loadRecentFiles().filter(file => file.path !== path),
    ])
    persist(next)
    return next
  },

  removeRecentFile(path: string): RecentFileEntry[] {
    const next = this.loadRecentFiles().filter(file => file.path !== path)
    persist(next)
    return next
  },

  async validateRecentFiles(): Promise<RecentFileEntry[]> {
    const stored = this.loadRecentFiles()
    const valid: RecentFileEntry[] = []
    for (const file of stored) {
      try {
        await vaultService.readFile(file.path)
        valid.push(file)
      } catch {
        // Missing or unreadable files are removed from the recent list.
      }
    }
    if (valid.length < stored.length) persist(valid)
    return valid
  },
}
