export interface ShortcutDef {
  id: string
  keys: string
  macKeys?: string
  description: string
  category: string
  action: () => void
}

class ShortcutManager {
  private shortcuts: Map<string, ShortcutDef> = new Map()
  private enabled = true

  register(def: ShortcutDef) {
    this.shortcuts.set(def.id, def)
  }

  unregister(id: string) {
    this.shortcuts.delete(id)
  }

  handleKeyDown(e: KeyboardEvent) {
    if (!this.enabled) return
    const mod = e.ctrlKey || e.metaKey
    const shift = e.shiftKey
    const key = e.key.toLowerCase()

    for (const [, def] of this.shortcuts) {
      const parts = (navigator.platform?.includes('Mac') ? (def.macKeys || def.keys) : def.keys).toLowerCase().split('+')
      const needsMod = parts.includes('ctrl') || parts.includes('cmd')
      const needsShift = parts.includes('shift')
      const targetKey = parts.filter(p => !['ctrl', 'cmd', 'shift'].includes(p))[0]

      if (needsMod !== mod) continue
      if (needsShift !== shift) continue
      if (targetKey !== key) continue

      e.preventDefault()
      def.action()
      return
    }
  }

  setEnabled(val: boolean) { this.enabled = val }
  getAll(): ShortcutDef[] { return Array.from(this.shortcuts.values()) }
  getByCategory(cat: string): ShortcutDef[] { return this.getAll().filter(s => s.category === cat) }
}

export const shortcutManager = new ShortcutManager()
