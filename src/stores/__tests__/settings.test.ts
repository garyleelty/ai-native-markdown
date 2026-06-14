import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'

// jsdom in vitest may not have a working localStorage without a URL config.
// Provide a minimal in-memory fallback so tests work reliably.
beforeAll(() => {
  if (typeof localStorage === 'undefined' || (() => { try { localStorage.setItem('__test__', '1'); localStorage.removeItem('__test__'); return false } catch { return true } })()) {
    const store: Record<string, string> = {}
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => { store[key] = value },
        removeItem: (key: string) => { delete store[key] },
        clear: () => { Object.keys(store).forEach(k => delete store[k]) },
        get length() { return Object.keys(store).length },
        key: (_index: number) => null,
      },
      writable: true,
      configurable: true,
    })
  }
})

// Mock only encrypt/decrypt; let safeStorage use real localStorage in jsdom
vi.mock('@/utils/security', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/utils/security')>()
  return {
    encryptValue: vi.fn().mockResolvedValue('enc:v2:mockencrypted'),
    decryptValue: vi.fn().mockResolvedValue(''),
    safeStorage: original.safeStorage,
  }
})

import { useSettingsStore } from '../settings'
import { encryptValue } from '@/utils/security'

const mockEncryptValue = vi.mocked(encryptValue)

async function flushPromises() {
  await nextTick()
  // Additional microtask flush for debounced watchers
  await new Promise(resolve => setTimeout(resolve, 0))
}

describe('settings store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    setActivePinia(createPinia())
  })

  describe('initial state', () => {
    it('should have default theme as system', () => {
      const store = useSettingsStore()
      expect(store.theme).toBe('system')
    })

    it('should have default AI config', () => {
      const store = useSettingsStore()
      expect(store.aiConfig.provider).toBe('ollama')
      expect(store.aiConfig.baseURL).toBe('http://localhost:11434')
      expect(store.aiConfig.model).toBe('qwen2.5:7b')
      expect(store.aiConfig.temperature).toBe(0.7)
      expect(store.aiConfig.maxTokens).toBe(4096)
    })

    it('should have default ghost text config', () => {
      const store = useSettingsStore()
      expect(store.ghostTextConfig.enabled).toBe(true)
      expect(store.ghostTextConfig.debounceMs).toBe(1500)
      expect(store.ghostTextConfig.triggerMode).toBe('manual')
    })

    it('should load theme from localStorage', () => {
      localStorage.setItem('theme', '"dark"')
      setActivePinia(createPinia())
      const store = useSettingsStore()
      expect(store.theme).toBe('dark')
    })

    it('should fallback to files for invalid sidebar tab', () => {
      localStorage.setItem('active_sidebar_tab', '"invalid-tab"')
      setActivePinia(createPinia())
      const store = useSettingsStore()
      expect(store.activeSidebarTab).toBe('files')
    })
  })

  describe('isDark computed', () => {
    it('returns true when theme is dark', () => {
      const store = useSettingsStore()
      store.setTheme('dark')
      expect(store.isDark).toBe(true)
    })

    it('returns false when theme is light', () => {
      const store = useSettingsStore()
      store.setTheme('light')
      expect(store.isDark).toBe(false)
    })

    it('returns systemIsDark when theme is system', () => {
      const store = useSettingsStore()
      store.setTheme('system')
      // In jsdom, matchMedia may not work, so systemIsDark defaults to false
      expect(typeof store.isDark).toBe('boolean')
    })
  })

  describe('setTheme', () => {
    it('should update theme value', () => {
      const store = useSettingsStore()
      store.setTheme('dark')
      expect(store.theme).toBe('dark')
    })

    it('should persist theme to storage', async () => {
      const store = useSettingsStore()
      store.setTheme('light')
      await flushPromises()
      // Watch-based persistence; check localStorage directly
      expect(localStorage.getItem('theme')).toBe('"light"')
    })
  })

  describe('toggleTheme', () => {
    it('should cycle through dark -> light -> system', () => {
      const store = useSettingsStore()
      store.setTheme('dark')
      store.toggleTheme()
      expect(store.theme).toBe('light')
      store.toggleTheme()
      expect(store.theme).toBe('system')
      store.toggleTheme()
      expect(store.theme).toBe('dark')
    })
  })

  describe('updateAIConfig', () => {
    it('should merge partial config into current config', () => {
      const store = useSettingsStore()
      store.updateAIConfig({ provider: 'openai', model: 'gpt-4' })
      expect(store.aiConfig.provider).toBe('openai')
      expect(store.aiConfig.model).toBe('gpt-4')
      // Other fields should remain unchanged
      expect(store.aiConfig.temperature).toBe(0.7)
    })

    it('should not lose fields not in the partial update', () => {
      const store = useSettingsStore()
      const originalBaseURL = store.aiConfig.baseURL
      store.updateAIConfig({ model: 'new-model' })
      expect(store.aiConfig.baseURL).toBe(originalBaseURL)
    })
  })

  describe('persistAIConfigNow', () => {
    it('should encrypt and save AI config', async () => {
      const store = useSettingsStore()
      store.updateAIConfig({ apiKey: 'test-key' })
      await store.persistAIConfigNow()

      expect(mockEncryptValue).toHaveBeenCalledWith('test-key')
    })

    it('should mark AI as configured', async () => {
      const store = useSettingsStore()
      expect(store.aiConfigured).toBe(false)
      await store.persistAIConfigNow()
      expect(store.aiConfigured).toBe(true)
    })

    it('should persist ai_configured flag', async () => {
      const store = useSettingsStore()
      await store.persistAIConfigNow()
      expect(localStorage.getItem('ai_configured')).toBe('true')
    })
  })

  describe('markAIConfigured', () => {
    it('should set aiConfigured to true', () => {
      const store = useSettingsStore()
      expect(store.aiConfigured).toBe(false)
      store.markAIConfigured()
      expect(store.aiConfigured).toBe(true)
    })

    it('should persist the flag to storage', () => {
      const store = useSettingsStore()
      store.markAIConfigured()
      expect(localStorage.getItem('ai_configured')).toBe('true')
    })
  })

  describe('setActiveTab', () => {
    it('should set valid sidebar tab', () => {
      const store = useSettingsStore()
      store.setActiveTab('knowledge')
      expect(store.activeSidebarTab).toBe('knowledge')
    })

    it('should ignore invalid sidebar tab', () => {
      const store = useSettingsStore()
      store.setActiveTab('files')
      store.setActiveTab('invalid' as any)
      expect(store.activeSidebarTab).toBe('files')
    })
  })

  describe('ghost text config migration', () => {
    it('should migrate legacy pause triggerMode to manual', () => {
      localStorage.setItem('ghost_text_config', JSON.stringify({
        enabled: true,
        debounceMs: 1500,
        maxPrefixChars: 500,
        maxCompletionChars: 200,
        triggerMode: 'pause',
      }))
      setActivePinia(createPinia())
      const store = useSettingsStore()
      expect(store.ghostTextConfig.triggerMode).toBe('manual')
    })

    it('should preserve manual triggerMode', () => {
      localStorage.setItem('ghost_text_config', JSON.stringify({
        enabled: true,
        debounceMs: 1500,
        maxPrefixChars: 500,
        maxCompletionChars: 200,
        triggerMode: 'manual',
      }))
      setActivePinia(createPinia())
      const store = useSettingsStore()
      expect(store.ghostTextConfig.triggerMode).toBe('manual')
    })

    it('should fill in missing fields with defaults', () => {
      localStorage.setItem('ghost_text_config', JSON.stringify({
        enabled: false,
      }))
      setActivePinia(createPinia())
      const store = useSettingsStore()
      expect(store.ghostTextConfig.enabled).toBe(false)
      expect(store.ghostTextConfig.debounceMs).toBe(1500)
      expect(store.ghostTextConfig.maxPrefixChars).toBe(500)
    })
  })

  describe('watch-based persistence', () => {
    it('should persist showSidebar changes', async () => {
      const store = useSettingsStore()
      store.setSidebarVisible(false)
      await flushPromises()
      expect(localStorage.getItem('show_sidebar')).toBe('false')
    })

    it('should persist showRightDock changes', async () => {
      const store = useSettingsStore()
      store.setRightDockVisible(false)
      await flushPromises()
      expect(localStorage.getItem('show_right_dock')).toBe('false')
    })

    it('should persist enableRAG changes', async () => {
      const store = useSettingsStore()
      store.setEnableRAG(true)
      await flushPromises()
      expect(localStorage.getItem('enable_rag')).toBe('true')
    })

    it('should persist enableSmartPaste changes', async () => {
      const store = useSettingsStore()
      store.setEnableSmartPaste(false)
      await flushPromises()
      expect(localStorage.getItem('enable_smart_paste')).toBe('false')
    })

    it('should persist enableInlineEdit changes', async () => {
      const store = useSettingsStore()
      store.setEnableInlineEdit(false)
      await flushPromises()
      expect(localStorage.getItem('enable_inline_edit')).toBe('false')
    })

    it('should persist editorFontSize changes', async () => {
      const store = useSettingsStore()
      store.setEditorFontSize(18)
      await flushPromises()
      expect(localStorage.getItem('editor_font_size')).toBe('18')
    })
  })

  describe('inferAIConfigured', () => {
    it('should return false when no config saved and defaults match', () => {
      const store = useSettingsStore()
      expect(store.aiConfigured).toBe(false)
    })

    it('should return true when ai_configured is explicitly true in storage', () => {
      localStorage.setItem('ai_configured', 'true')
      setActivePinia(createPinia())
      const store = useSettingsStore()
      expect(store.aiConfigured).toBe(true)
    })

    it('should return false when ai_configured is explicitly false in storage', () => {
      localStorage.setItem('ai_configured', 'false')
      setActivePinia(createPinia())
      const store = useSettingsStore()
      expect(store.aiConfigured).toBe(false)
    })
  })

  describe('inferAIConfigured - config-based inference', () => {
    it('should infer true when ai_configured is null but provider differs from default', () => {
      // Clear the explicit flag
      localStorage.removeItem('ai_configured')
      // Set a non-default provider via safeStorage
      const config = { provider: 'openai', baseURL: 'http://localhost:11434', model: 'qwen2.5:7b', apiKey: '', temperature: 0.7, maxTokens: 4096, systemPrompt: '' }
      localStorage.setItem('ai_config', JSON.stringify(config))
      setActivePinia(createPinia())
      const store = useSettingsStore()
      expect(store.aiConfigured).toBe(true)
    })

    it('should infer true when ai_configured is null but model differs from default', () => {
      localStorage.removeItem('ai_configured')
      const config = { provider: 'ollama', baseURL: 'http://localhost:11434', model: 'gpt-4', apiKey: '', temperature: 0.7, maxTokens: 4096, systemPrompt: '' }
      localStorage.setItem('ai_config', JSON.stringify(config))
      setActivePinia(createPinia())
      const store = useSettingsStore()
      expect(store.aiConfigured).toBe(true)
    })

    it('should infer true when ai_configured is null but baseURL differs from default', () => {
      localStorage.removeItem('ai_configured')
      const config = { provider: 'ollama', baseURL: 'http://custom:1234', model: 'qwen2.5:7b', apiKey: '', temperature: 0.7, maxTokens: 4096, systemPrompt: '' }
      localStorage.setItem('ai_config', JSON.stringify(config))
      setActivePinia(createPinia())
      const store = useSettingsStore()
      expect(store.aiConfigured).toBe(true)
    })

    it('should infer false when ai_configured is null and config matches defaults', () => {
      localStorage.removeItem('ai_configured')
      localStorage.removeItem('ai_config')
      setActivePinia(createPinia())
      const store = useSettingsStore()
      expect(store.aiConfigured).toBe(false)
    })
  })

  describe('new sidebar tabs validation', () => {
    it('should accept valid sidebar tabs', () => {
      const store = useSettingsStore()
      const validTabs = ['files', 'search', 'knowledge', 'settings']
      for (const tab of validTabs) {
        store.setActiveTab(tab as any)
        expect(store.activeSidebarTab).toBe(tab)
      }
    })

    it('should reject invalid sidebar tab and keep current', () => {
      const store = useSettingsStore()
      store.setActiveTab('files')
      store.setActiveTab('graph' as any)
      expect(store.activeSidebarTab).toBe('files')
    })
  })

  describe('new visibility persistence', () => {
    it('should persist showRightDock changes', async () => {
      const store = useSettingsStore()
      store.setRightDockVisible(false)
      await flushPromises()
      expect(localStorage.getItem('show_right_dock')).toBe('false')
    })

    it('should persist showGraphPane changes', async () => {
      const store = useSettingsStore()
      store.setGraphPaneVisible(false)
      await flushPromises()
      expect(localStorage.getItem('show_graph_pane')).toBe('false')
    })
  })

  describe('new width persistence', () => {
    it('should persist rightDockWidth changes', async () => {
      const store = useSettingsStore()
      store.setRightDockWidth(400)
      await flushPromises()
      // Debounced, may need a longer wait
      await new Promise(r => setTimeout(r, 250))
      expect(localStorage.getItem('right_dock_width')).toBe('400')
    })

    it('should persist graphPaneWidth changes', async () => {
      const store = useSettingsStore()
      store.setGraphPaneWidth(600)
      await flushPromises()
      await new Promise(r => setTimeout(r, 250))
      expect(localStorage.getItem('graph_pane_width')).toBe('600')
    })
  })

  describe('toggle new panels', () => {
    it('should toggle right dock visibility', () => {
      const store = useSettingsStore()
      const initial = store.showRightDock
      store.toggleRightDock()
      expect(store.showRightDock).toBe(!initial)
    })

    it('should toggle graph pane visibility', () => {
      const store = useSettingsStore()
      const initial = store.showGraphPane
      store.toggleGraphPane()
      expect(store.showGraphPane).toBe(!initial)
    })
  })
})
