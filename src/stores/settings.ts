import { defineStore } from 'pinia'
import { onScopeDispose, ref, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import type { AIConfig, ThemeMode, SidebarTab, GhostTextConfig } from '@/types'
import { encryptValue, safeStorage, decryptValue } from '@/utils/security'

const sidebarTabs: SidebarTab[] = ['files', 'graph', 'rss', 'ai', 'outline', 'settings']

const defaultAIConfig: AIConfig = {
  provider: 'ollama',
  baseURL: 'http://localhost:11434',
  apiKey: '',
  model: 'qwen2.5:7b',
  temperature: 0.7,
  maxTokens: 4096,
  systemPrompt: '你是一个专业的 Markdown 写作助手。'
}

function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return defaultValue
    return JSON.parse(raw) as T
  } catch {
    if (typeof defaultValue === 'string') {
      try {
        const raw = localStorage.getItem(key)
        return (raw ?? defaultValue) as T
      } catch {
        return defaultValue
      }
    }
    return defaultValue
  }
}

function loadEncryptedConfig(key: string, defaultValue: AIConfig): AIConfig {
  try {
    const parsed = safeStorage.get<AIConfig | null>(key, null)
    if (!parsed) return defaultValue
    // v2 encrypted keys (enc:v2:) require async decryption;
    // return as-is and let migrateEncryptedConfig handle them
    if (parsed.apiKey && parsed.apiKey.startsWith('enc:v2:')) {
      return parsed
    }
    // v1 keys use legacy XOR which is synchronous via the fallback path
    // but decryptValue is async, so we handle v1 sync decode inline
    if (parsed.apiKey && parsed.apiKey.startsWith('enc:v1:')) {
      parsed.apiKey = legacyDeobfuscateV1Sync(parsed.apiKey)
    }
    return parsed
  } catch {
    return defaultValue
  }
}

// Synchronous v1 XOR deobfuscation for backward compatibility
// Mirrors the logic in security.ts legacyDeobfuscateV1
const V1_PREFIX = 'enc:v1:'
const V1_CRYPTO_KEY = 'ai-native-md-obf-2024'

function legacyDeobfuscateV1Sync(ciphertext: string): string {
  if (!ciphertext.startsWith(V1_PREFIX)) return ciphertext
  try {
    const decoded = atob(ciphertext.slice(V1_PREFIX.length))
    let result = ''
    for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(decoded.charCodeAt(i) ^ V1_CRYPTO_KEY.charCodeAt(i % V1_CRYPTO_KEY.length))
    }
    return decodeURIComponent(escape(atob(result)))
  } catch {
    return ''
  }
}


async function saveEncryptedConfig(key: string, value: AIConfig): Promise<void> {
  try {
    const toStore = { ...value }
    if (toStore.apiKey) {
      // Write non-encrypted fields synchronously first so they're immediately available,
      // then update with encrypted apiKey asynchronously
      safeStorage.set(key, { ...toStore, apiKey: '' })
      toStore.apiKey = await encryptValue(toStore.apiKey)
    }
    safeStorage.set(key, toStore)
  } catch {
  }
}

function saveToStorage(key: string, value: unknown): void {
  safeStorage.set(key, value)
}

function loadSidebarTab(): SidebarTab {
  const tab = loadFromStorage<SidebarTab>('active_sidebar_tab', 'files')
  return sidebarTabs.includes(tab) ? tab : 'files'
}

export const useSettingsStore = defineStore('settings', () => {
  const theme = ref<ThemeMode>(loadFromStorage('theme', 'system'))
  const aiConfig = ref<AIConfig>(loadEncryptedConfig('ai_config', { ...defaultAIConfig }))
  const sidebarWidth = ref(loadFromStorage('sidebar_width', 280))
  const aiPanelHeight = ref(loadFromStorage('ai_panel_height', 260))
  const showSidebar = ref(loadFromStorage('show_sidebar', true))
  const showAIPanel = ref(loadFromStorage('show_ai_panel', false))
  const activeSidebarTab = ref<SidebarTab>(loadSidebarTab())
  const livePreview = ref(loadFromStorage('live_preview', true))
  const enableRAG = ref(loadFromStorage('enable_rag', false))
  const enableAIActions = ref(loadFromStorage('enable_ai_actions', true))
  const enableSmartPaste = ref(loadFromStorage('enable_smart_paste', true))
  const ghostTextConfig = ref<GhostTextConfig>(loadFromStorage('ghost_text_config', {
    enabled: true,
    debounceMs: 1500,
    maxPrefixChars: 500,
    maxCompletionChars: 200,
    triggerMode: 'pause' as const,
  }))
  const enableInlineEdit = ref(loadFromStorage('enable_inline_edit', true))

  const systemThemeQuery = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null
  const systemIsDark = ref(systemThemeQuery?.matches ?? false)
  const handleSystemThemeChange = (e: MediaQueryListEvent | MediaQueryList) => {
    systemIsDark.value = e.matches
    if (theme.value === 'system') applyTheme()
  }
  if (systemThemeQuery) {
    if (typeof systemThemeQuery.addEventListener === 'function') {
      systemThemeQuery.addEventListener('change', handleSystemThemeChange)
    } else {
      systemThemeQuery.addListener(handleSystemThemeChange)
    }
  }
  onScopeDispose(() => {
    if (!systemThemeQuery) return
    if (typeof systemThemeQuery.removeEventListener === 'function') {
      systemThemeQuery.removeEventListener('change', handleSystemThemeChange)
    } else {
      systemThemeQuery.removeListener(handleSystemThemeChange)
    }
  })

  const isDark = () => {
    if (theme.value === 'dark') return true
    if (theme.value === 'light') return false
    return systemIsDark.value
  }

  const applyTheme = () => {
    const dark = isDark()
    document.documentElement.classList.toggle('dark', dark)
    document.documentElement.classList.toggle('light', !dark)
  }

  const setTheme = (mode: ThemeMode) => {
    theme.value = mode
    applyTheme()
  }

  const toggleTheme = () => {
    const themes: ThemeMode[] = ['dark', 'light', 'system']
    const idx = themes.indexOf(theme.value)
    setTheme(themes[(idx + 1) % themes.length])
  }

  const updateAIConfig = (config: Partial<AIConfig>) => {
    aiConfig.value = { ...aiConfig.value, ...config }
  }

  const setSidebarVisible = (visible: boolean) => {
    showSidebar.value = visible
  }
  const setAIPanelVisible = (visible: boolean) => {
    showAIPanel.value = visible
  }
  const toggleSidebar = () => { setSidebarVisible(!showSidebar.value) }
  const toggleAIPanel = () => { setAIPanelVisible(!showAIPanel.value) }
  const toggleLivePreview = () => {
    livePreview.value = !livePreview.value
  }
  const setEnableRAG = (enabled: boolean) => { enableRAG.value = enabled }
  const setEnableAIActions = (enabled: boolean) => {
    enableAIActions.value = enabled
  }
  const setEnableSmartPaste = (enabled: boolean) => {
    enableSmartPaste.value = enabled
  }
  const setEnableInlineEdit = (enabled: boolean) => {
    enableInlineEdit.value = enabled
  }
  const setActiveTab = (tab: SidebarTab) => {
    if (!sidebarTabs.includes(tab)) return
    activeSidebarTab.value = tab
  }
  const setSidebarWidth = (width: number) => {
    sidebarWidth.value = width
  }
  const setAIPanelHeight = (height: number) => {
    aiPanelHeight.value = height
  }

  // Unified persistence via watchers with debounced writes for rapid-fire settings
  const debouncedSaveWidth = useDebounceFn((val: number) => { saveToStorage('sidebar_width', val) }, 200)
  const debouncedSaveHeight = useDebounceFn((val: number) => { saveToStorage('ai_panel_height', val) }, 200)
  const debouncedSaveGhost = useDebounceFn((val: GhostTextConfig) => { saveToStorage('ghost_text_config', val) }, 300)
  const debouncedSaveAI = useDebounceFn((val: AIConfig) => { saveEncryptedConfig('ai_config', val) }, 300)

  watch(theme, (val) => { saveToStorage('theme', val) })
  watch(aiConfig, (val) => { debouncedSaveAI(val) }, { deep: true })
  watch(showSidebar, (val) => { saveToStorage('show_sidebar', val) })
  watch(showAIPanel, (val) => { saveToStorage('show_ai_panel', val) })
  watch(enableRAG, (val) => { saveToStorage('enable_rag', val) })
  watch(enableAIActions, (val) => { saveToStorage('enable_ai_actions', val) })
  watch(enableSmartPaste, (val) => { saveToStorage('enable_smart_paste', val) })
  watch(ghostTextConfig, (val) => { debouncedSaveGhost(val) }, { deep: true })
  watch(enableInlineEdit, (val) => { saveToStorage('enable_inline_edit', val) })
  watch(activeSidebarTab, (val) => { saveToStorage('active_sidebar_tab', val) })
  watch(sidebarWidth, (val) => { debouncedSaveWidth(val) })
  watch(aiPanelHeight, (val) => { debouncedSaveHeight(val) })
  watch(livePreview, (val) => { saveToStorage('live_preview', val) })

  applyTheme()

  return {
    theme, aiConfig, sidebarWidth, aiPanelHeight,
    showSidebar, showAIPanel, activeSidebarTab, livePreview, enableRAG,
    enableAIActions, enableSmartPaste, ghostTextConfig, enableInlineEdit,
    isDark, applyTheme, setTheme, toggleTheme, updateAIConfig,
    toggleSidebar, toggleAIPanel, toggleLivePreview, setSidebarVisible, setAIPanelVisible, setActiveTab,
    setEnableRAG, setEnableAIActions, setEnableSmartPaste, setEnableInlineEdit,
    setSidebarWidth, setAIPanelHeight,
  }
})
