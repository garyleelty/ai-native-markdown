import Dexie, { type Table } from 'dexie'

export interface Snapshot {
  id?: number
  filePath: string
  content: string
  timestamp: number
  label: string
  charCount: number
}

class VersionDB extends Dexie {
  snapshots!: Table<Snapshot>

  constructor() {
    super('ai-markdown-versions')
    this.version(1).stores({
      snapshots: '++id, filePath, timestamp, [filePath+timestamp]'
    })
  }
}

const db = new VersionDB()

export const versionHistory = {
  async saveSnapshot(filePath: string, content: string, label?: string): Promise<number> {
    const existing = await db.snapshots
      .where('filePath')
      .equals(filePath)
      .sortBy('timestamp')

    const last = existing[existing.length - 1]
    if (last && last.content === content) return last.id!

    const maxPerFile = 50
    if (existing.length >= maxPerFile) {
      const toDelete = existing.slice(0, existing.length - maxPerFile + 1).map(s => s.id!)
      await db.snapshots.bulkDelete(toDelete)
    }

    return db.snapshots.add({
      filePath,
      content,
      timestamp: Date.now(),
      label: label || '自动保存',
      charCount: content.length,
    })
  },

  async getSnapshots(filePath: string): Promise<Snapshot[]> {
    return db.snapshots
      .where('filePath')
      .equals(filePath)
      .sortBy('timestamp')
  },

  async getSnapshot(id: number): Promise<Snapshot | undefined> {
    return db.snapshots.get(id)
  },

  async restoreSnapshot(id: number): Promise<string | null> {
    const snapshot = await db.snapshots.get(id)
    return snapshot?.content || null
  },

  async deleteSnapshot(id: number): Promise<void> {
    await db.snapshots.delete(id)
  },

  async clearHistory(filePath: string): Promise<void> {
    await db.snapshots.where('filePath').equals(filePath).delete()
  }
}
