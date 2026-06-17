import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useFileSelectionStore } from '../fileSelection'

describe('fileSelection store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('selects one path', () => {
    const store = useFileSelectionStore()
    store.selectOnly('/a.md')
    expect(store.selectedPathList).toEqual(['/a.md'])
    expect(store.selectedCount).toBe(1)
  })

  it('toggles selection', () => {
    const store = useFileSelectionStore()
    store.toggleSelection('/a.md')
    store.toggleSelection('/b.md')
    expect(store.selectedPathList).toEqual(['/a.md', '/b.md'])
    store.toggleSelection('/a.md')
    expect(store.selectedPathList).toEqual(['/b.md'])
  })

  it('selects a visible range', () => {
    const store = useFileSelectionStore()
    store.setVisiblePaths(['/a.md', '/b.md', '/c.md', '/d.md'])
    store.selectOnly('/b.md')
    store.selectRange('/d.md')
    expect(store.selectedPathList).toEqual(['/b.md', '/c.md', '/d.md'])
  })

  it('handles mouse modifiers', () => {
    const store = useFileSelectionStore()
    store.setVisiblePaths(['/a.md', '/b.md', '/c.md'])
    store.handleNodeSelection('/a.md')
    store.handleNodeSelection('/c.md', { shiftKey: true } as MouseEvent)
    expect(store.selectedPathList).toEqual(['/a.md', '/b.md', '/c.md'])
    store.handleNodeSelection('/b.md', { ctrlKey: true } as MouseEvent)
    expect(store.selectedPathList).toEqual(['/a.md', '/c.md'])
  })

  it('removes selected paths and updates anchor only when needed', () => {
    const store = useFileSelectionStore()
    store.setVisiblePaths(['/a.md', '/b.md', '/c.md'])
    store.selectOnly('/a.md')
    store.selectRange('/c.md')
    expect(store.selectedPathList).toEqual(['/a.md', '/b.md', '/c.md'])
    store.removeSelected(['/b.md'])
    expect(store.selectedPathList).toEqual(['/a.md', '/c.md'])
    store.removeSelected(['/c.md'])
    expect(store.lastSelectedPath).toBe('/a.md')
    store.removeSelected(['/a.md'])
    expect(store.selectedPathList).toEqual([])
  })

  it('clears and prunes invisible selection', () => {
    const store = useFileSelectionStore()
    store.setVisiblePaths(['/a.md', '/b.md'])
    store.toggleSelection('/a.md')
    store.toggleSelection('/b.md')
    store.setVisiblePaths(['/b.md'])
    expect(store.selectedPathList).toEqual(['/b.md'])
    store.clearSelection()
    expect(store.selectedPathList).toEqual([])
  })
})
