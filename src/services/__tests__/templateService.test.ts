import { beforeEach, describe, expect, it, vi } from 'vitest'
import { templateService, TEMPLATES_STORAGE_KEY, TemplateEntry } from '../templateService'
import { safeStorage } from '@/utils/security'

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

describe('templateService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
  })

  it('returns built-in templates when no user templates exist', () => {
    const all = templateService.getAllTemplates()
    expect(all.length).toBeGreaterThanOrEqual(8)
    expect(all.some(t => t.id === 'blank')).toBe(true)
    expect(all.some(t => t.builtIn === true)).toBe(true)
  })

  it('saves a user template and persists it', () => {
    templateService.saveUserTemplate({ name: 'My Note', content: '# Hello\n\nWorld' })
    const all = templateService.getAllTemplates()
    const userTpl = all.find(t => t.name === 'My Note')
    expect(userTpl).toBeDefined()
    expect(userTpl!.content).toBe('# Hello\n\nWorld')
    expect(userTpl!.builtIn).toBe(false)

    const stored = safeStorage.get(TEMPLATES_STORAGE_KEY, [])
    expect(stored.length).toBe(1)
  })

  it('deletes a user template by id', () => {
    templateService.saveUserTemplate({ name: 'Temp', content: 'x' })
    const all = templateService.getAllTemplates()
    const userTpl = all.find(t => t.name === 'Temp')!
    templateService.deleteUserTemplate(userTpl.id)
    expect(templateService.getAllTemplates().find(t => t.id === userTpl.id)).toBeUndefined()
  })

  it('updates an existing user template', () => {
    templateService.saveUserTemplate({ name: 'Old', content: 'old' })
    const all = templateService.getAllTemplates()
    const userTpl = all.find(t => t.name === 'Old')!
    templateService.saveUserTemplate({ id: userTpl.id, name: 'New', content: 'new' })
    const updated = templateService.getAllTemplates().find(t => t.id === userTpl.id)!
    expect(updated.name).toBe('New')
    expect(updated.content).toBe('new')
  })

  it('cannot delete built-in templates', () => {
    const before = templateService.getAllTemplates().length
    templateService.deleteUserTemplate('blank')
    expect(templateService.getAllTemplates().length).toBe(before)
  })

  it('returns false when deleteUserTemplate id does not exist', () => {
    const result = templateService.deleteUserTemplate('nonexistent-id')
    expect(result).toBe(false)
  })

  it('rejects empty template name', () => {
    expect(() => templateService.saveUserTemplate({ name: '', content: 'x' })).toThrow('Template name cannot be empty')
    expect(() => templateService.saveUserTemplate({ name: '   ', content: 'x' })).toThrow('Template name cannot be empty')
  })

  it('enforces user template limit for new templates', () => {
    for (let i = 0; i < 50; i++) {
      templateService.saveUserTemplate({ name: `Tpl ${i}`, content: 'x' })
    }
    expect(() => templateService.saveUserTemplate({ name: 'Overflow', content: 'x' })).toThrow('Cannot create more than 50 user templates')
  })

  it('allows updating an existing template even at limit', () => {
    for (let i = 0; i < 50; i++) {
      templateService.saveUserTemplate({ name: `Tpl ${i}`, content: 'x' })
    }
    const users = templateService.getUserTemplates()
    const first = users[0]
    const updated = templateService.saveUserTemplate({ id: first.id, name: 'Updated', content: 'new' })
    expect(updated.name).toBe('Updated')
  })

  it('normalizes corrupted storage data', () => {
    localStorageMock.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify([
      { id: 'good', name: 'Good', content: 'ok', builtIn: false },
      { id: 123, name: 'Bad id', content: 'x', builtIn: false },
      { name: 'No id', content: 'x', builtIn: false },
      { id: 'dup', name: 'Dup1', content: 'a', builtIn: false },
      { id: 'dup', name: 'Dup2', content: 'b', builtIn: false },
      { id: 'no-name', name: '', content: 'x', builtIn: false },
      null,
      'string',
    ]))
    const users = templateService.getUserTemplates()
    expect(users.length).toBe(2)
    expect(users[0].id).toBe('good')
    expect(users[1].id).toBe('dup')
    expect(users[1].name).toBe('Dup1')
  })
})
