import { readonly, ref } from 'vue'
import { safeStorage } from '@/utils/security'

export interface FavoriteEntry {
  name: string
  path: string
}

export const FAVORITES_STORAGE_KEY = 'ai-markdown:favorites'
const MAX_FAVORITES = 100

const favorites = ref<FavoriteEntry[]>([])

function nameFromPath(path: string): string {
  return path.split('/').filter(Boolean).pop() || path
}

function normalizeFavorites(value: unknown): FavoriteEntry[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const result: FavoriteEntry[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const path = typeof (item as FavoriteEntry).path === 'string' ? (item as FavoriteEntry).path : ''
    if (!path || seen.has(path)) continue
    const storedName = typeof (item as FavoriteEntry).name === 'string' ? (item as FavoriteEntry).name : ''
    const name = storedName || nameFromPath(path)
    if (!name) continue
    seen.add(path)
    result.push({ name, path })
    if (result.length >= MAX_FAVORITES) break
  }
  return result
}

function persist(value: FavoriteEntry[]): void {
  safeStorage.set(FAVORITES_STORAGE_KEY, value.slice(0, MAX_FAVORITES))
}

function syncFromStorage(): void {
  const stored = normalizeFavorites(safeStorage.get<FavoriteEntry[]>(FAVORITES_STORAGE_KEY, []))
  const storedKeys = stored.map(f => f.path).join(',')
  const currentKeys = favorites.value.map(f => f.path).join(',')
  if (storedKeys !== currentKeys) favorites.value = stored
}

function ensureInitialized(): void {
  syncFromStorage()
}

const isFavorite = (path: string): boolean => {
  ensureInitialized()
  return favorites.value.some(item => item.path === path)
}

const addFavorite = (path: string): void => {
  ensureInitialized()
  if (!path || isFavorite(path)) return
  favorites.value = normalizeFavorites([{ name: nameFromPath(path), path }, ...favorites.value])
  persist(favorites.value)
}

const removeFavorite = (path: string): void => {
  ensureInitialized()
  const next = favorites.value.filter(item => item.path !== path)
  if (next.length === favorites.value.length) return
  favorites.value = next
  persist(favorites.value)
}

const toggleFavorite = (path: string): void => {
  if (isFavorite(path)) removeFavorite(path)
  else addFavorite(path)
}

export function useFavorites() {
  ensureInitialized()
  return {
    favorites: readonly(favorites),
    addFavorite,
    removeFavorite,
    toggleFavorite,
    isFavorite,
  }
}
