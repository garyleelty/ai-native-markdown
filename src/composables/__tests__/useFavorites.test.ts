import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { useFavorites, FAVORITES_STORAGE_KEY } from '../useFavorites'
import { safeStorage } from '@/utils/security'

beforeAll(() => {
  if (typeof localStorage === 'undefined' || (() => { try { localStorage.setItem('__test__', '1'); localStorage.removeItem('__test__'); return false } catch { return true } })()) {
    const store: Record<string, string> = {}
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => { store[key] = value },
        removeItem: (key: string) => { delete store[key] },
        clear: () => { Object.keys(store).forEach(key => delete store[key]) },
        key: () => null,
        get length() { return Object.keys(store).length },
      },
      writable: true,
      configurable: true,
    })
  }
})

describe('useFavorites', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('starts empty when no favorites are stored', () => {
    const { favorites } = useFavorites()
    expect(favorites.value).toEqual([])
  })

  it('toggles a favorite and persists it', () => {
    const { favorites, toggleFavorite, isFavorite } = useFavorites()

    toggleFavorite('/workspace/A.md')

    expect(favorites.value).toEqual([{ name: 'A.md', path: '/workspace/A.md' }])
    expect(isFavorite('/workspace/A.md')).toBe(true)
    expect(safeStorage.get(FAVORITES_STORAGE_KEY, [])).toEqual(favorites.value)

    toggleFavorite('/workspace/A.md')

    expect(favorites.value).toEqual([])
    expect(isFavorite('/workspace/A.md')).toBe(false)
  })

  it('prevents duplicates', () => {
    const { favorites, addFavorite } = useFavorites()

    addFavorite('/workspace/A.md')
    addFavorite('/workspace/A.md')

    expect(favorites.value).toEqual([{ name: 'A.md', path: '/workspace/A.md' }])
  })

  it('loads persisted favorites with normalized names', () => {
    safeStorage.set(FAVORITES_STORAGE_KEY, [
      { name: '', path: '/workspace/Untitled.md' },
      { name: 'Duplicate.md', path: '/workspace/Untitled.md' },
      { name: 'B.md', path: '/workspace/B.md' },
    ])

    const { favorites } = useFavorites()

    expect(favorites.value).toEqual([
      { name: 'Untitled.md', path: '/workspace/Untitled.md' },
      { name: 'B.md', path: '/workspace/B.md' },
    ])
  })

  it('caps favorites at 100 entries', () => {
    const { favorites, addFavorite } = useFavorites()
    for (let i = 0; i < 105; i++) addFavorite(`/workspace/file-${i}.md`)
    expect(favorites.value.length).toBe(100)
  })
})
