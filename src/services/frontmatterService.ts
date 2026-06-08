import { parseFrontmatter } from '@/utils/metadata'
import type { PropertyType, PropertyTypePref } from '@/types/properties'
export type { PropertyType, PropertyTypePref } from '@/types/properties'

export function inferPropertyType(key: string, value: any): PropertyType {
  if (value === true || value === false ||
      value === 'true' || value === 'false') {
    return 'boolean'
  }

  if (typeof value === 'string' &&
      /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?/.test(value)) {
    return 'date'
  }

  if (typeof value === 'string' &&
      /^https?:\/\//.test(value)) {
    return 'url'
  }

  if (typeof value === 'string' &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return 'email'
  }

  if (typeof value === 'number' ||
      (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value))) {
    return 'number'
  }

  if (Array.isArray(value) &&
      value.every(item => typeof item === 'string' && item.startsWith('#'))) {
    return 'tag'
  }
  if (typeof value === 'string' &&
      value.startsWith('#')) {
    return 'tag'
  }

  if (key.toLowerCase().includes('date') ||
      key.toLowerCase().includes('created') ||
      key.toLowerCase().includes('updated')) {
    return 'date'
  }
  if (key.toLowerCase().includes('tag') ||
      key.toLowerCase().includes('tags')) {
    return 'tag'
  }
  if (key.toLowerCase().includes('link') ||
      key.toLowerCase().includes('url')) {
    return 'url'
  }
  if (key.toLowerCase().includes('email')) {
    return 'email'
  }

  return 'text'
}

export function inferPropertyTypes(frontmatter: Record<string, any>): PropertyTypePref {
  const types: PropertyTypePref = {}
  for (const [key, value] of Object.entries(frontmatter)) {
    types[key] = inferPropertyType(key, value)
  }
  return types
}

export function serializeFrontmatter(
  frontmatter: Record<string, any>,
  currentContent: string
): string {
  const { body } = parseFrontmatter(currentContent)

  const yamlLines: string[] = []
  for (const [key, value] of Object.entries(frontmatter)) {
    if (value === undefined || value === null ||
        (typeof value === 'string' && value === '') ||
        (Array.isArray(value) && value.length === 0)) {
      continue
    }

    if (Array.isArray(value)) {
      yamlLines.push(`${key}:`)
      for (const item of value) {
        yamlLines.push(`  - ${JSON.stringify(item)}`)
      }
    } else if (typeof value === 'string') {
      yamlLines.push(`${key}: ${JSON.stringify(value)}`)
    } else if (typeof value === 'boolean' || typeof value === 'number') {
      yamlLines.push(`${key}: ${value}`)
    }
  }

  const newFrontmatter = yamlLines.length > 0
    ? `---\n${yamlLines.join('\n')}\n---\n`
    : ''

  return newFrontmatter + body
}

export function mergePropertyTypes(
  inferred: PropertyTypePref,
  userPrefs: PropertyTypePref
): PropertyTypePref {
  const merged: PropertyTypePref = { ...inferred }
  for (const [key, type] of Object.entries(userPrefs)) {
    if (inferred[key] !== undefined) {
      merged[key] = type
    }
  }
  return merged
}
