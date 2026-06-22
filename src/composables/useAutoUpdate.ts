import { ref, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'

export interface UpdateState {
  status: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  version?: string
  releaseNotes?: string
  error?: string
  downloadPercent?: number
}

export function useAutoUpdate() {
  const updateState = ref<UpdateState>({ status: 'idle' })
  const isElectron = typeof window !== 'undefined' && Boolean(window.aiNativeUpdater)

  let unsubStatus: (() => void) | null = null
  let unsubProgress: (() => void) | null = null

  function getUpdater() {
    return window.aiNativeUpdater
  }

  async function checkForUpdates() {
    const updater = getUpdater()
    if (!updater) return
    updateState.value = { status: 'checking' }
    try {
      const result = await updater.checkForUpdates()
      if (!result.ok && result.error) {
        updateState.value = { status: 'error', error: result.error }
      }
    } catch (err) {
      updateState.value = { status: 'error', error: String(err) }
    }
  }

  async function downloadUpdate() {
    const updater = getUpdater()
    if (!updater) return
    updateState.value = { ...updateState.value, status: 'downloading', downloadPercent: 0 }
    try {
      const result = await updater.downloadUpdate()
      if (!result.ok && result.error) {
        updateState.value = { status: 'error', error: result.error }
      }
    } catch (err) {
      updateState.value = { status: 'error', error: String(err) }
    }
  }

  function installUpdate() {
    const updater = getUpdater()
    if (!updater) return
    updater.installUpdate()
  }

  onMounted(() => {
    const updater = getUpdater()
    if (!updater) return

    unsubStatus = updater.onStatus((data) => {
      switch (data.status) {
        case 'checking':
          updateState.value = { status: 'checking' }
          break
        case 'available':
          updateState.value = {
            status: 'available',
            version: data.version,
            releaseNotes: data.releaseNotes,
          }
          break
        case 'not-available':
          updateState.value = { status: 'not-available' }
          break
        case 'downloaded':
          updateState.value = { ...updateState.value, status: 'downloaded' }
          break
        case 'error':
          updateState.value = { status: 'error', error: data.error }
          break
      }
    })

    unsubProgress = updater.onProgress((data) => {
      updateState.value = { ...updateState.value, downloadPercent: data.percent }
    })
  })

  onUnmounted(() => {
    unsubStatus?.()
    unsubProgress?.()
  })

  return {
    updateState,
    isElectron,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
  }
}
