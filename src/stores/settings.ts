import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { AIConfig, ThemeMode, SidebarTab, VoiceInputMode } from '@/types'

const defaultAIConfig: AIConfig = {
  provider: 'ollama',
  baseURL: 'http://localhost:11434',
  apiKey: '',
  model: 'qwen2.5:7b',
  temperature: 0.7,
  maxTokens: 4096,
  systemPrompt: '你是一个专业的 Markdown 写作助手。'
}

const isTauri = '__TAURI_INTERNALS__' in window

let tauriStore: any = null

async function getTauriStore() {
  if (!isTauri) return null
  if (tauriStore) return tauriStore
  try {
    const { load } = await import('@tauri-apps/plugin-store')
    tauriStore = await load('settings.json', {
      autoSave: 100,
      defaults: {}
    })
    return tauriStore
  } catch {
    return null
  }
}

async function persistGet<T>(key: string, defaultValue: T): Promise<T> {
  const store = await getTauriStore()
  if (store) {
    try {
      const val = await store.get(key) as T | undefined
      return val ?? defaultValue
    } catch {
      return defaultValue
    }
  }
  const raw = localStorage.getItem(key)
  if (raw === null) return defaultValue
  try {
    return JSON.parse(raw) as T
  } catch {
    return raw as unknown as T
  }
}

async function persistSet(key: string, value: unknown): Promise<void> {
  const store = await getTauriStore()
  if (store) {
    try {
      await store.set(key, value)
      return
    } catch {
      // fallback to localStorage
    }
  }
  localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value))
}

export const useSettingsStore = defineStore('settings', () => {
  const theme = ref<ThemeMode>('system')
  const aiConfig = ref<AIConfig>({ ...defaultAIConfig })
  const sidebarWidth = ref(260)
  const aiPanelHeight = ref(220)
  const showSidebar = ref(true)
  const showAIPanel = ref(false)
  const activeSidebarTab = ref<SidebarTab>('files')
  const livePreview = ref(true)
  const voiceInputMode = ref<VoiceInputMode>('hold')
  const voiceInputLanguage = ref('zh-CN')

  const initialized = ref(false)

  const initSettings = async () => {
    if (initialized.value) return

    theme.value = await persistGet<ThemeMode>('theme', 'system')
    aiConfig.value = await persistGet<AIConfig>('ai_config', { ...defaultAIConfig })
    sidebarWidth.value = await persistGet<number>('sidebar_width', 260)
    aiPanelHeight.value = await persistGet<number>('ai_panel_height', 220)
    livePreview.value = await persistGet<boolean>('live_preview', true)
    voiceInputMode.value = await persistGet<VoiceInputMode>('voice_input_mode', 'hold')
    voiceInputLanguage.value = await persistGet<string>('voice_input_language', 'zh-CN')

    initialized.value = true
  }

  initSettings()

  const isDark = () => {
    if (theme.value === 'dark') return true
    if (theme.value === 'light') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  }

  const applyTheme = () => {
    const dark = isDark()
    document.documentElement.classList.toggle('light', !dark)
    document.documentElement.classList.toggle('dark', dark)
  }

  const setTheme = (mode: ThemeMode) => {
    theme.value = mode
    applyTheme()
  }

  const toggleTheme = () => {
    const themes: ThemeMode[] = ['dark', 'light']
    const idx = themes.indexOf(theme.value)
    setTheme(themes[(idx + 1) % themes.length])
  }

  const updateAIConfig = (config: Partial<AIConfig>) => {
    aiConfig.value = { ...aiConfig.value, ...config }
  }

  const toggleSidebar = () => { showSidebar.value = !showSidebar.value }
  const toggleAIPanel = () => { showAIPanel.value = !showAIPanel.value }
  const toggleLivePreview = () => { livePreview.value = !livePreview.value }
  const setActiveTab = (tab: SidebarTab) => { activeSidebarTab.value = tab }
  const setSidebarWidth = (width: number) => { sidebarWidth.value = width }
  const setAIPanelHeight = (height: number) => { aiPanelHeight.value = height }
  const setVoiceInputMode = (mode: VoiceInputMode) => { voiceInputMode.value = mode }
  const setVoiceInputLanguage = (lang: string) => { voiceInputLanguage.value = lang }

  watch(theme, (val) => { persistSet('theme', val) })
  watch(aiConfig, (val) => { persistSet('ai_config', val) }, { deep: true })
  watch(sidebarWidth, (val) => { persistSet('sidebar_width', val) })
  watch(aiPanelHeight, (val) => { persistSet('ai_panel_height', val) })
  watch(livePreview, (val) => { persistSet('live_preview', val) })
  watch(voiceInputMode, (val) => { persistSet('voice_input_mode', val) })
  watch(voiceInputLanguage, (val) => { persistSet('voice_input_language', val) })

  return {
    theme, aiConfig, sidebarWidth, aiPanelHeight,
    showSidebar, showAIPanel, activeSidebarTab, livePreview,
    voiceInputMode, voiceInputLanguage,
    isDark, applyTheme, setTheme, toggleTheme, updateAIConfig, toggleSidebar, toggleAIPanel, toggleLivePreview, setActiveTab,
    setSidebarWidth, setAIPanelHeight,
    setVoiceInputMode, setVoiceInputLanguage
  }
})
