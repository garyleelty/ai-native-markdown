import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { AIConfig, ThemeMode, SidebarTab, GhostTextConfig } from '@/types'
import { obfuscateValue, deobfuscateValue } from '@/utils/security'

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
    return defaultValue
  }
}

function loadEncryptedConfig(key: string, defaultValue: AIConfig): AIConfig {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return defaultValue
    const parsed = JSON.parse(raw) as AIConfig
    if (parsed.apiKey) {
      parsed.apiKey = deobfuscateValue(parsed.apiKey)
    }
    return parsed
  } catch {
    return defaultValue
  }
}

function saveEncryptedConfig(key: string, value: AIConfig): void {
  try {
    const toStore = { ...value }
    if (toStore.apiKey) {
      toStore.apiKey = obfuscateValue(toStore.apiKey)
    }
    localStorage.setItem(key, JSON.stringify(toStore))
  } catch {
  }
}

function saveToStorage(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value))
  } catch {
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const theme = ref<ThemeMode>(loadFromStorage('theme', 'system'))
  const aiConfig = ref<AIConfig>(loadEncryptedConfig('ai_config', { ...defaultAIConfig }))
  const sidebarWidth = ref(loadFromStorage('sidebar_width', 280))
  const aiPanelHeight = ref(loadFromStorage('ai_panel_height', 260))
  const showSidebar = ref(true)
  const showAIPanel = ref(false)
  const activeSidebarTab = ref<SidebarTab>('files')
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

  const systemIsDark = ref(window.matchMedia('(prefers-color-scheme: dark)').matches)
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    systemIsDark.value = e.matches
    if (theme.value === 'system') applyTheme()
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
    saveToStorage('theme', mode)
  }

  const toggleTheme = () => {
    const themes: ThemeMode[] = ['dark', 'light', 'system']
    const idx = themes.indexOf(theme.value)
    setTheme(themes[(idx + 1) % themes.length])
  }

  const updateAIConfig = (config: Partial<AIConfig>) => {
    aiConfig.value = { ...aiConfig.value, ...config }
    saveEncryptedConfig('ai_config', aiConfig.value)
  }

  const toggleSidebar = () => { showSidebar.value = !showSidebar.value }
  const toggleAIPanel = () => { showAIPanel.value = !showAIPanel.value }
  const toggleLivePreview = () => {
    livePreview.value = !livePreview.value
    saveToStorage('live_preview', livePreview.value)
  }
  const setActiveTab = (tab: SidebarTab) => { activeSidebarTab.value = tab }
  const setSidebarWidth = (width: number) => {
    sidebarWidth.value = width
    saveToStorage('sidebar_width', width)
  }
  const setAIPanelHeight = (height: number) => {
    aiPanelHeight.value = height
    saveToStorage('ai_panel_height', height)
  }

  watch(aiConfig, (val) => { saveEncryptedConfig('ai_config', val) }, { deep: true })
  watch(enableRAG, (val) => { saveToStorage('enable_rag', val) })
  watch(ghostTextConfig, (val) => { saveToStorage('ghost_text_config', val) }, { deep: true })

  applyTheme()

  return {
    theme, aiConfig, sidebarWidth, aiPanelHeight,
    showSidebar, showAIPanel, activeSidebarTab, livePreview, enableRAG,
    enableAIActions, enableSmartPaste, ghostTextConfig, enableInlineEdit,
    isDark, applyTheme, setTheme, toggleTheme, updateAIConfig,
    toggleSidebar, toggleAIPanel, toggleLivePreview, setActiveTab,
    setSidebarWidth, setAIPanelHeight,
  }
})
