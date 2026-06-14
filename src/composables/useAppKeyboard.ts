import type { Ref } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useEditorStore } from '@/stores/editor'

interface UseAppKeyboardOptions {
  editorRef: () => any
  settingsStore: ReturnType<typeof useSettingsStore>
  editorStore: ReturnType<typeof useEditorStore>
  handleSaveKeyDown: (e: KeyboardEvent) => void
  showVersionHistory: Ref<boolean>
  showCommandPalette: Ref<boolean>
  focusMode: Ref<boolean>
  mobileSidebarOpen: Ref<boolean>
  sidebarVisible: () => boolean
  closeMobileSidebar: () => void
  toggleSidebar: () => void
}

export function useAppKeyboard(options: UseAppKeyboardOptions) {
  const {
    editorRef,
    settingsStore,
    editorStore,
    handleSaveKeyDown,
    showVersionHistory,
    showCommandPalette,
    focusMode,
    mobileSidebarOpen,
    sidebarVisible,
    closeMobileSidebar,
    toggleSidebar,
  } = options

  const handleKeyDown = (e: KeyboardEvent) => {
    handleSaveKeyDown(e)
    const mod = e.ctrlKey || e.metaKey
    if (mod && e.key === 'b') {
      e.preventDefault()
      if (editorRef()) editorRef().wrapSelection?.('**', '**')
    } else if (mod && e.key === 'i') {
      e.preventDefault()
      if (editorRef()) editorRef().wrapSelection?.('*', '*')
    } else if (mod && e.key === 'k') {
      e.preventDefault()
      if (editorRef()) editorRef().insertLink?.()
    } else if (mod && e.shiftKey && (e.key === 'H' || e.key === 'h')) {
      e.preventDefault()
      if (editorStore.currentFile) showVersionHistory.value = true
    } else if (mod && (e.key === 'P' || e.key === 'p')) {
      e.preventDefault()
      showCommandPalette.value = true
    } else if (mod && e.key === '\\') {
      e.preventDefault()
      focusMode.value = !focusMode.value
    } else if (e.key === 'F11') {
      e.preventDefault()
      focusMode.value = !focusMode.value
    } else if (e.key === 'Escape' && mobileSidebarOpen.value) {
      closeMobileSidebar()
    } else if (e.key === 'Escape' && focusMode.value) {
      focusMode.value = false
    } else if (mod && e.key === '1') {
      e.preventDefault()
      settingsStore.setActiveTab('files')
      if (!sidebarVisible()) toggleSidebar()
    } else if (mod && e.key === '2') {
      e.preventDefault()
      settingsStore.setActiveTab('search')
      if (!sidebarVisible()) toggleSidebar()
    } else if (mod && e.key === '3') {
      e.preventDefault()
      settingsStore.setActiveTab('knowledge')
      if (!sidebarVisible()) toggleSidebar()
    } else if (mod && e.key === '4') {
      e.preventDefault()
      settingsStore.setActiveTab('rss')
      if (!sidebarVisible()) toggleSidebar()
    } else if (mod && e.key === '5') {
      e.preventDefault()
      settingsStore.setActiveTab('settings')
      if (!sidebarVisible()) toggleSidebar()
    }
  }

  return { handleKeyDown }
}
