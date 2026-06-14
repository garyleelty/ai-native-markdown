import { ref } from 'vue'
import { useEditorStore } from '@/stores/editor'
import { vaultService } from '@/services/vault'

export function useTabManagement(options: {
  editorStore: () => ReturnType<typeof useEditorStore>
  saveCurrentFile: () => void
  handleCloseTab: (tabId: string) => void
  editorRef: () => any
}) {
  const tabContextMenuVisible = ref(false)
  const tabContextMenuTargetId = ref<string | null>(null)
  const tabContextMenuPosition = ref({ x: 0, y: 0 })
  const tabDragFromIndex = ref<number | null>(null)

  const handleTabDragStart = (_event: DragEvent, fromIndex: number) => {
    tabDragFromIndex.value = fromIndex
  }

  const handleTabDrop = (_event: DragEvent, targetIndexStr: string) => {
    const toIndex = parseInt(targetIndexStr, 10)
    if (isNaN(toIndex) || tabDragFromIndex.value === null || tabDragFromIndex.value === toIndex) return
    const store = options.editorStore()
    store.reorderOpenTabs(tabDragFromIndex.value, toIndex)
    tabDragFromIndex.value = null
  }

  const showTabContextMenu = (event: MouseEvent, tabId: string) => {
    event.preventDefault()
    tabContextMenuTargetId.value = tabId
    tabContextMenuPosition.value = { x: event.clientX, y: event.clientY }
    tabContextMenuVisible.value = true
  }

  const hideTabContextMenu = () => {
    tabContextMenuVisible.value = false
    tabContextMenuTargetId.value = null
  }

  const handleTabContextCommand = async (command: string) => {
    const targetId = tabContextMenuTargetId.value
    tabContextMenuVisible.value = false
    tabContextMenuTargetId.value = null
    if (!targetId) return

    const store = options.editorStore()
    const targetIndex = store.openTabs.findIndex(tab => tab.id === targetId)
    if (targetIndex === -1) return

    switch (command) {
      case 'save': {
        const tab = store.openTabs[targetIndex]
        if (tab?.isModified && tab.filePath) {
          await vaultService.writeFile(tab.filePath, tab.content)
          tab.isModified = false
          if (tab.id === store.activeTabId) {
            store.setContentSilent(tab.content)
          }
        }
        break
      }
      case 'close':
        options.handleCloseTab(targetId)
        break
      case 'closeOthers':
        for (const tab of [...store.openTabs]) {
          if (tab.id !== targetId) options.handleCloseTab(tab.id)
        }
        break
      case 'closeAll':
        for (const tab of [...store.openTabs]) {
          options.handleCloseTab(tab.id)
        }
        break
    }
  }

  return {
    tabContextMenuVisible,
    tabContextMenuTargetId,
    tabContextMenuPosition,
    tabDragFromIndex,
    handleTabDragStart,
    handleTabDrop,
    showTabContextMenu,
    hideTabContextMenu,
    handleTabContextCommand,
  }
}
