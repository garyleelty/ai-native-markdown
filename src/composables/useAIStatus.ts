import { ref, computed, onMounted, onUnmounted } from 'vue'
import { aiService } from '@/services/ai'
import { useSettingsStore } from '@/stores/settings'

export function useAIStatus() {
  const settingsStore = useSettingsStore()
  const providerStatus = ref<string>('idle')
  const providerError = ref<string>('')

  const refreshProviderStatus = () => {
    const p = aiService.getActiveProvider()
    providerStatus.value = p?.status ?? 'idle'
    providerError.value = p?.lastError ?? ''
  }

  const aiPanelState = computed(() => {
    if (!settingsStore.aiConfigured) return 'unconfigured'
    return providerStatus.value
  })

  const goToAIConfig = () => {
    settingsStore.setSidebarVisible(true)
    settingsStore.setActiveTab('settings')
  }

  const setProviderStatus = (status: string) => {
    providerStatus.value = status
  }

  let unsubscribeStatus: (() => void) | null = null

  onMounted(() => {
    refreshProviderStatus()
    unsubscribeStatus = aiService.onStatusChange(() => {
      refreshProviderStatus()
    })
  })

  onUnmounted(() => {
    unsubscribeStatus?.()
  })

  return {
    providerStatus,
    providerError,
    aiPanelState,
    refreshProviderStatus,
    setProviderStatus,
    goToAIConfig,
  }
}
