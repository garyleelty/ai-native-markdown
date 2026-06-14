import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { ViewMode } from '@/types'
import { safeStorage } from '@/utils/security'
import { vaultService } from '@/services/vault'

interface Tab {
  id: string
  filePath: string
  fileName: string
  content: string
  isModified: boolean
}

const TAB_STATE_KEY = 'editor_tab_state'
const DEFAULT_TAB_STATE: { tabs: Tab[]; activeTabId: string | null; viewMode: ViewMode } = {
  tabs: [],
  activeTabId: null,
  viewMode: 'live-preview',
}

function loadTabState(): { tabs: Tab[]; activeTabId: string | null; viewMode: ViewMode } {
  const state = safeStorage.get(TAB_STATE_KEY, DEFAULT_TAB_STATE)
  const tabs = Array.isArray(state.tabs) ? state.tabs : []
  const activeTabId = tabs.some(tab => tab.id === state.activeTabId) ? state.activeTabId : null
  const viewMode: ViewMode = ['source', 'live-preview', 'preview'].includes(state.viewMode)
    ? state.viewMode
    : DEFAULT_TAB_STATE.viewMode
  return { tabs, activeTabId, viewMode }
}

function saveTabState(tabs: Tab[], activeTabId: string | null, viewMode: ViewMode) {
  const state = {
    tabs: tabs.map(t => ({ ...t, content: t.isModified ? t.content : '' })),
    activeTabId,
    viewMode,
  }
  safeStorage.set(TAB_STATE_KEY, state)
}

const savedState = loadTabState()

export const useEditorStore = defineStore('editor', () => {
  const content = ref('')
  const currentFile = ref('')
  const viewMode = ref<ViewMode>(savedState.viewMode || 'live-preview')
  const cursorLine = ref(0)
  const cursorColumn = ref(0)
  const isModified = ref(false)
  const openTabs = ref<Tab[]>(savedState.tabs || [])
  const activeTabId = ref<string | null>(savedState.activeTabId)

  const setContent = (value: string) => {
    if (content.value === value) return
    content.value = value
    isModified.value = true
    if (activeTabId.value) {
      const tab = openTabs.value.find(t => t.id === activeTabId.value)
      if (tab) {
        tab.content = value
        tab.isModified = true
      }
    }
  }

  const setContentSilent = (value: string) => {
    content.value = value
    isModified.value = false
    if (activeTabId.value) {
      const tab = openTabs.value.find(t => t.id === activeTabId.value)
      if (tab) {
        tab.content = value
        tab.isModified = false
      }
    }
  }

  const setViewMode = (mode: ViewMode) => { viewMode.value = mode }

  const setCursor = (line: number, column: number) => {
    cursorLine.value = line
    cursorColumn.value = column
  }

  const markSaved = () => {
    isModified.value = false
    if (activeTabId.value) markTabSaved(activeTabId.value)
  }

  const markPathSaved = (filePath: string, savedContent?: string) => {
    const tab = openTabs.value.find(t => t.filePath === filePath)
    if (!tab) return
    if (savedContent !== undefined && tab.content !== savedContent) return
    tab.isModified = false
    if (activeTabId.value === tab.id && (savedContent === undefined || content.value === savedContent)) {
      isModified.value = false
    }
  }

  const addTab = (filePath: string, contentStr: string) => {
    const existingTab = openTabs.value.find(t => t.filePath === filePath)
    if (existingTab) {
      switchTab(existingTab.id)
      return
    }
    const fileName = filePath.split('/').pop() || 'untitled.md'
    const newTab: Tab = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      filePath,
      fileName,
      content: contentStr,
      isModified: false
    }
    openTabs.value.push(newTab)
    switchTab(newTab.id)
  }

  const closeTab = (tabId: string) => {
    const index = openTabs.value.findIndex(t => t.id === tabId)
    if (index === -1) return
    openTabs.value.splice(index, 1)
    if (activeTabId.value === tabId) {
      const newActiveIndex = Math.min(index, openTabs.value.length - 1)
      if (openTabs.value.length > 0) {
        switchTab(openTabs.value[newActiveIndex].id)
      } else {
        activeTabId.value = null
        content.value = ''
        currentFile.value = ''
        isModified.value = false
      }
    }
  }

  const switchTab = (tabId: string) => {
    const tab = openTabs.value.find(t => t.id === tabId)
    if (!tab) return
    activeTabId.value = tabId
    content.value = tab.content
    currentFile.value = tab.filePath
    isModified.value = tab.isModified
  }

  const hydrateRestoredSession = async () => {
    if (openTabs.value.length === 0) {
      activeTabId.value = null
      content.value = ''
      currentFile.value = ''
      isModified.value = false
      return ''
    }

    const restoredTabs: Tab[] = []
    for (const tab of openTabs.value) {
      if (tab.isModified) {
        restoredTabs.push(tab)
        continue
      }

      try {
        const fileContent = await vaultService.readFile(tab.filePath)
        restoredTabs.push({
          ...tab,
          content: fileContent,
          isModified: false,
        })
      } catch {
        // Saved tabs can be dropped if their backing file disappeared while the app was closed.
      }
    }

    openTabs.value = restoredTabs

    if (openTabs.value.length === 0) {
      activeTabId.value = null
      content.value = ''
      currentFile.value = ''
      isModified.value = false
      return ''
    }

    if (!activeTabId.value || !openTabs.value.some(t => t.id === activeTabId.value)) {
      activeTabId.value = openTabs.value[0].id
    }

    const tab = getActiveTab()
    if (!tab) return ''

    activeTabId.value = tab.id
    currentFile.value = tab.filePath
    content.value = tab.content
    isModified.value = tab.isModified
    return tab.content
  }

  const markTabSaved = (tabId: string) => {
    const tab = openTabs.value.find(t => t.id === tabId)
    if (!tab) return
    tab.isModified = false
    if (activeTabId.value === tabId) isModified.value = false
  }

  const renameOpenPath = (oldPath: string, newPath: string, isDirectory = false) => {
    let changed = false
    for (const tab of openTabs.value) {
      const matches = tab.filePath === oldPath || (isDirectory && tab.filePath.startsWith(`${oldPath}/`))
      if (!matches) continue
      tab.filePath = tab.filePath === oldPath ? newPath : `${newPath}${tab.filePath.slice(oldPath.length)}`
      tab.fileName = tab.filePath.split('/').pop() || 'untitled.md'
      changed = true
    }

    if (currentFile.value === oldPath || (isDirectory && currentFile.value.startsWith(`${oldPath}/`))) {
      currentFile.value = currentFile.value === oldPath ? newPath : `${newPath}${currentFile.value.slice(oldPath.length)}`
    }

    return changed
  }

  const removeOpenPath = (path: string, isDirectory = false) => {
    const removedActive = activeTabId.value
      ? openTabs.value.some(tab => tab.id === activeTabId.value && (tab.filePath === path || (isDirectory && tab.filePath.startsWith(`${path}/`))))
      : false

    openTabs.value = openTabs.value.filter(tab => tab.filePath !== path && !(isDirectory && tab.filePath.startsWith(`${path}/`)))

    if (openTabs.value.length === 0) {
      activeTabId.value = null
      content.value = ''
      currentFile.value = ''
      isModified.value = false
      return removedActive
    }

    if (removedActive || !activeTabId.value || !openTabs.value.some(tab => tab.id === activeTabId.value)) {
      switchTab(openTabs.value[0].id)
    }

    return removedActive
  }

  const getActiveTab = () => {
    if (!activeTabId.value) return null
    return openTabs.value.find(t => t.id === activeTabId.value) || null
  }

  const moveTab = (fromIndex: number, toIndex: number) => {
    const tab = openTabs.value.splice(fromIndex, 1)[0]
    if (tab) {
      openTabs.value.splice(toIndex, 0, tab)
    }
  }

  const reorderOpenTabs = moveTab

  watch([openTabs, activeTabId, viewMode], () => {
    saveTabState(openTabs.value, activeTabId.value, viewMode.value)
  }, { deep: true })

  return {
    content, currentFile, viewMode, cursorLine, cursorColumn, isModified,
    openTabs, activeTabId,
    setContent, setContentSilent, setViewMode, setCursor, markSaved, markPathSaved,
    addTab, closeTab, switchTab, markTabSaved, renameOpenPath, removeOpenPath, reorderOpenTabs,
    getActiveTab, moveTab, hydrateRestoredSession
  }
})
