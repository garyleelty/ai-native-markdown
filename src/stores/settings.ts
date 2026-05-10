import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { AIConfig, ThemeMode, SidebarTab, VoiceInputMode } from '@/types'

const defaultAIConfig: AIConfig = {
  provider: 'ollama',
  baseURL: '/api/ai/ollama',
  apiKey: '',
  model: 'qwen2.5:7b',
  temperature: 0.7,
  maxTokens: 4096,
  systemPrompt: '你是一个专业的 Markdown 写作助手。'
}

export const useSettingsStore = defineStore('settings', () => {
  const theme = ref<ThemeMode>((localStorage.getItem('theme') as ThemeMode) || 'system')
  const aiConfig = ref<AIConfig>(JSON.parse(localStorage.getItem('ai_config') || JSON.stringify(defaultAIConfig)))
  const sidebarWidth = ref(Number(localStorage.getItem('sidebar_width') || 260))
  const aiPanelHeight = ref(Number(localStorage.getItem('ai_panel_height') || 220))
  const showSidebar = ref(true)
  const showAIPanel = ref(false)
  const activeSidebarTab = ref<SidebarTab>('files')
  const splitRatio = ref(Number(localStorage.getItem('split_ratio') || 50))
  const voiceInputMode = ref<VoiceInputMode>((localStorage.getItem('voice_input_mode') as VoiceInputMode) || 'hold')
  const voiceInputLanguage = ref(localStorage.getItem('voice_input_language') || 'zh-CN')

  const setTheme = (mode: ThemeMode) => { theme.value = mode }

  const updateAIConfig = (config: Partial<AIConfig>) => {
    aiConfig.value = { ...aiConfig.value, ...config }
  }

  const toggleSidebar = () => { showSidebar.value = !showSidebar.value }
  const toggleAIPanel = () => { showAIPanel.value = !showAIPanel.value }
  const setActiveTab = (tab: SidebarTab) => { activeSidebarTab.value = tab }
  const setSidebarWidth = (width: number) => { sidebarWidth.value = width }
  const setAIPanelHeight = (height: number) => { aiPanelHeight.value = height }
  const setSplitRatio = (ratio: number) => { splitRatio.value = ratio }
  const setVoiceInputMode = (mode: VoiceInputMode) => { voiceInputMode.value = mode }
  const setVoiceInputLanguage = (lang: string) => { voiceInputLanguage.value = lang }

  watch(theme, (val) => { localStorage.setItem('theme', val) })
  watch(aiConfig, (val) => { localStorage.setItem('ai_config', JSON.stringify(val)) }, { deep: true })
  watch(sidebarWidth, (val) => { localStorage.setItem('sidebar_width', String(val)) })
  watch(aiPanelHeight, (val) => { localStorage.setItem('ai_panel_height', String(val)) })
  watch(splitRatio, (val) => { localStorage.setItem('split_ratio', String(val)) })
  watch(voiceInputMode, (val) => { localStorage.setItem('voice_input_mode', val) })
  watch(voiceInputLanguage, (val) => { localStorage.setItem('voice_input_language', val) })

  return {
    theme, aiConfig, sidebarWidth, aiPanelHeight,
    showSidebar, showAIPanel, activeSidebarTab, splitRatio,
    voiceInputMode, voiceInputLanguage,
    setTheme, updateAIConfig, toggleSidebar, toggleAIPanel, setActiveTab,
    setSidebarWidth, setAIPanelHeight, setSplitRatio,
    setVoiceInputMode, setVoiceInputLanguage
  }
})
