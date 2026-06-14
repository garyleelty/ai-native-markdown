import { defineStore } from 'pinia'
import { onScopeDispose, ref, watch, computed } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import type { AIConfig, ThemeMode, SidebarTab, GhostTextConfig, QuickActionItem } from '@/types'
import { SIDEBAR_TABS } from '@/types'
import { encryptValue, safeStorage, decryptValue } from '@/utils/security'



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

/**
 * Asynchronously decrypt v2-encrypted API keys after store initialization.
 * Called once in App.vue onMounted before configuring the AI provider.
 */
async function decryptAIConfigIfNeeded(config: AIConfig): Promise<AIConfig> {
  if (!config.apiKey || !config.apiKey.startsWith('enc:v2:')) return config
  try {
    const decrypted = await decryptValue(config.apiKey)
    if (decrypted) {
      config.apiKey = decrypted
    }
  } catch {
    // Decryption failed; leave as-is
  }
  return config
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
      // Encrypt the API key before storing
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
  return SIDEBAR_TABS.includes(tab) ? tab : 'files'
}

const defaultGhostTextConfig: GhostTextConfig = {
  enabled: true,
  debounceMs: 1500,
  maxPrefixChars: 500,
  maxCompletionChars: 200,
  triggerMode: 'manual',
}

function loadGhostTextConfig(): GhostTextConfig {
  const loaded = loadFromStorage<Partial<GhostTextConfig>>('ghost_text_config', {})
  return {
    ...defaultGhostTextConfig,
    ...loaded,
    // Legacy configs were created before there was a visible mode control, so avoid silent network calls.
    triggerMode: loaded.triggerMode === 'pause' ? 'manual' : (loaded.triggerMode ?? defaultGhostTextConfig.triggerMode),
  }
}

/**
 * 推断 AI 是否已配置：如果 storage 中没有 ai_configured 键，
 * 但 ai_config 已有非默认配置（用户之前保存过），则视为已配置。
 */
function inferAIConfigured(): boolean {
  const stored = loadFromStorage<boolean | null>('ai_configured', null)
  if (stored !== null) return stored
  // ai_configured 键不存在，检查 ai_config 是否有用户保存过的配置
  const config = loadEncryptedConfig('ai_config', { ...defaultAIConfig })
  // 如果 provider 或 model 与默认值不同，说明用户之前配置过
  if (config.provider !== defaultAIConfig.provider || config.model !== defaultAIConfig.model) {
    return true
  }
  // 如果 baseURL 不是默认值，也说明配置过
  if (config.baseURL !== defaultAIConfig.baseURL) {
    return true
  }
  return false
}

export const useSettingsStore = defineStore('settings', () => {
  const theme = ref<ThemeMode>(loadFromStorage('theme', 'system'))
  const aiConfigured = ref<boolean>(inferAIConfigured())
  const aiConfig = ref<AIConfig>(loadEncryptedConfig('ai_config', { ...defaultAIConfig }))
  const sidebarWidth = ref(loadFromStorage('sidebar_width', 280))
  const rightDockWidth = ref(loadFromStorage('right_dock_width', 300))
  const graphPaneWidth = ref(loadFromStorage('graph_pane_width', 480))
  const aiPanelHeight = ref(loadFromStorage('ai_panel_height', 260))
  const aiPanelWidth = ref(loadFromStorage('ai_panel_width', 380))
  const showSidebar = ref(loadFromStorage('show_sidebar', true))
  const showRightDock = ref(loadFromStorage('show_right_dock', true))
  const showGraphPane = ref(loadFromStorage('show_graph_pane', true))
  const showAIPanel = ref(loadFromStorage('show_ai_panel', false))
  const activeSidebarTab = ref<SidebarTab>(loadSidebarTab())
  const livePreview = ref(loadFromStorage('live_preview', true))
  const enableRAG = ref(loadFromStorage('enable_rag', false))
  const enableAIActions = ref(loadFromStorage('enable_ai_actions', true))
  const enableSmartPaste = ref(loadFromStorage('enable_smart_paste', true))
  const ghostTextConfig = ref<GhostTextConfig>(loadGhostTextConfig())
  const enableInlineEdit = ref(loadFromStorage('enable_inline_edit', true))
  const wordWrap = ref(loadFromStorage('word_wrap', true))
  const findCaseSensitive = ref(loadFromStorage('find_case_sensitive', false))
  const findUseRegex = ref(loadFromStorage('find_use_regex', false))
  const quickActions = ref<QuickActionItem[]>(loadFromStorage('quick_actions', []))
  const editorFontSize = ref(loadFromStorage('editor_font_size', 14))
  const editorLineHeight = ref(loadFromStorage('editor_line_height', 1.8))
  const editorFontFamily = ref(loadFromStorage('editor_font_family', 'var(--font-mono)'))
  const splitRatio = ref(loadFromStorage('split_ratio', 0.5))
  const autoSaveDelay = ref(loadFromStorage('auto_save_delay', 2000))
  const rightDockSections = ref<{ outline: boolean; properties: boolean; relations: boolean }>(
    loadFromStorage('right_dock_sections', { outline: true, properties: true, relations: true })
  )

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

  const isDark = computed(() => {
    if (theme.value === 'dark') return true
    if (theme.value === 'light') return false
    return systemIsDark.value
  })

  const applyTheme = () => {
    const dark = isDark.value
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
  const persistAIConfigNow = async () => {
    await saveEncryptedConfig('ai_config', aiConfig.value)
    aiConfigured.value = true
    saveToStorage('ai_configured', true)
  }
  const markAIConfigured = () => {
    aiConfigured.value = true
    saveToStorage('ai_configured', true)
  }

  const setSidebarVisible = (visible: boolean) => {
    showSidebar.value = visible
  }
  const setRightDockVisible = (visible: boolean) => {
    showRightDock.value = visible
  }
  const setGraphPaneVisible = (visible: boolean) => {
    showGraphPane.value = visible
  }
  const setAIPanelVisible = (visible: boolean) => {
    showAIPanel.value = visible
  }
  const toggleSidebar = () => { setSidebarVisible(!showSidebar.value) }
  const toggleRightDock = () => { setRightDockVisible(!showRightDock.value) }
  const toggleGraphPane = () => { setGraphPaneVisible(!showGraphPane.value) }
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
    if (!SIDEBAR_TABS.includes(tab)) return
    activeSidebarTab.value = tab
  }
  const setSidebarWidth = (width: number) => {
    sidebarWidth.value = width
  }
  const setRightDockWidth = (width: number) => {
    rightDockWidth.value = width
  }
  const setGraphPaneWidth = (width: number) => {
    graphPaneWidth.value = width
  }
  const setAIPanelHeight = (height: number) => {
    aiPanelHeight.value = height
  }
  const setAIPanelWidth = (width: number) => {
    aiPanelWidth.value = width
  }
  const setEditorFontSize = (size: number) => {
    editorFontSize.value = size
  }
  const setEditorLineHeight = (height: number) => {
    editorLineHeight.value = height
  }
  const setEditorFontFamily = (family: string) => {
    editorFontFamily.value = family
  }
  const setSplitRatio = (ratio: number) => {
    splitRatio.value = ratio
  }
  const setAutoSaveDelay = (delay: number) => {
    autoSaveDelay.value = delay
  }

  // Unified persistence via watchers with debounced writes for rapid-fire settings
  const debouncedSaveWidth = useDebounceFn((val: number) => { saveToStorage('sidebar_width', val) }, 200)
  const debouncedSaveRightDockWidth = useDebounceFn((val: number) => { saveToStorage('right_dock_width', val) }, 200)
  const debouncedSaveGraphPaneWidth = useDebounceFn((val: number) => { saveToStorage('graph_pane_width', val) }, 200)
  const debouncedSaveHeight = useDebounceFn((val: number) => { saveToStorage('ai_panel_height', val) }, 200)
  const debouncedSaveAIPanelWidth = useDebounceFn((val: number) => { saveToStorage('ai_panel_width', val) }, 200)
  const debouncedSaveSplitRatio = useDebounceFn((val: number) => { saveToStorage('split_ratio', val) }, 200)
  const debouncedSaveGhost = useDebounceFn((val: GhostTextConfig) => { saveToStorage('ghost_text_config', val) }, 300)
  const debouncedSaveAI = useDebounceFn((val: AIConfig) => { saveEncryptedConfig('ai_config', val) }, 300)

  watch(theme, (val) => { saveToStorage('theme', val) })
  watch(aiConfig, (val) => { debouncedSaveAI(val) }, { deep: true })
  watch(showSidebar, (val) => { saveToStorage('show_sidebar', val) })
  watch(showRightDock, (val) => { saveToStorage('show_right_dock', val) })
  watch(showGraphPane, (val) => { saveToStorage('show_graph_pane', val) })
  watch(showAIPanel, (val) => { saveToStorage('show_ai_panel', val) })
  watch(enableRAG, (val) => { saveToStorage('enable_rag', val) })
  watch(enableAIActions, (val) => { saveToStorage('enable_ai_actions', val) })
  watch(enableSmartPaste, (val) => { saveToStorage('enable_smart_paste', val) })
  watch(ghostTextConfig, (val) => { debouncedSaveGhost(val) }, { deep: true })
  watch(enableInlineEdit, (val) => { saveToStorage('enable_inline_edit', val) })
  watch(wordWrap, (val) => { saveToStorage('word_wrap', val) })
  watch(findCaseSensitive, (val) => { saveToStorage('find_case_sensitive', val) })
  watch(findUseRegex, (val) => { saveToStorage('find_use_regex', val) })
  watch(quickActions, (val) => { saveToStorage('quick_actions', val) }, { deep: true })
  watch(activeSidebarTab, (val) => { saveToStorage('active_sidebar_tab', val) })
  watch(sidebarWidth, (val) => { debouncedSaveWidth(val) })
  watch(rightDockWidth, (val) => { debouncedSaveRightDockWidth(val) })
  watch(graphPaneWidth, (val) => { debouncedSaveGraphPaneWidth(val) })
  watch(aiPanelHeight, (val) => { debouncedSaveHeight(val) })
  watch(aiPanelWidth, (val) => { debouncedSaveAIPanelWidth(val) })
  watch(livePreview, (val) => { saveToStorage('live_preview', val) })
  watch(editorFontSize, (val) => { saveToStorage('editor_font_size', val) })
  watch(editorLineHeight, (val) => { saveToStorage('editor_line_height', val) })
  watch(editorFontFamily, (val) => { saveToStorage('editor_font_family', val) })
  watch(splitRatio, (val) => { debouncedSaveSplitRatio(val) })
  watch(autoSaveDelay, (val) => { saveToStorage('auto_save_delay', val) })
  watch(rightDockSections, (val) => { saveToStorage('right_dock_sections', val) }, { deep: true })

  const resetToDefaults = () => {
    theme.value = 'system'
    sidebarWidth.value = 280
    rightDockWidth.value = 300
    graphPaneWidth.value = 480
    aiPanelHeight.value = 260
    aiPanelWidth.value = 380
    showSidebar.value = true
    showRightDock.value = true
    showGraphPane.value = true
    showAIPanel.value = false
    activeSidebarTab.value = 'files'
    livePreview.value = true
    enableRAG.value = false
    enableAIActions.value = true
    enableSmartPaste.value = true
    ghostTextConfig.value = { ...defaultGhostTextConfig }
    enableInlineEdit.value = true
    wordWrap.value = true
    findCaseSensitive.value = false
    findUseRegex.value = false
    quickActions.value = []
    editorFontSize.value = 14
    editorLineHeight.value = 1.8
    editorFontFamily.value = 'var(--font-mono)'
    splitRatio.value = 0.5
    autoSaveDelay.value = 2000
    rightDockSections.value = { outline: true, properties: true, relations: true }
    applyTheme()
  }

  const decryptAndApplyAIConfig = async () => {
    const decrypted = await decryptAIConfigIfNeeded(aiConfig.value)
    if (decrypted.apiKey !== aiConfig.value.apiKey) {
      aiConfig.value = decrypted
    }
  }

  applyTheme()

  return {
    theme, aiConfig, aiConfigured, sidebarWidth, rightDockWidth, graphPaneWidth, aiPanelHeight, aiPanelWidth,
    showSidebar, showRightDock, showGraphPane, showAIPanel, activeSidebarTab, livePreview, enableRAG,
    enableAIActions, enableSmartPaste, ghostTextConfig, enableInlineEdit, wordWrap, findCaseSensitive, findUseRegex, quickActions,
    editorFontSize, editorLineHeight, editorFontFamily, splitRatio, autoSaveDelay, rightDockSections,
    isDark, applyTheme, setTheme, toggleTheme, updateAIConfig, persistAIConfigNow, markAIConfigured,
    toggleSidebar, toggleRightDock, toggleGraphPane, toggleAIPanel, toggleLivePreview,
    setSidebarVisible, setRightDockVisible, setGraphPaneVisible, setAIPanelVisible, setActiveTab,
    setEnableRAG, setEnableAIActions, setEnableSmartPaste, setEnableInlineEdit,
    setSidebarWidth, setRightDockWidth, setGraphPaneWidth, setAIPanelHeight, setAIPanelWidth,
    setEditorFontSize, setEditorLineHeight, setEditorFontFamily, setSplitRatio, setAutoSaveDelay,
    setWordWrap: (val: boolean) => { wordWrap.value = val },
    setGhostTextConfig: (val: GhostTextConfig) => { ghostTextConfig.value = val },
    resetToDefaults,
    decryptAndApplyAIConfig,
  }
})
