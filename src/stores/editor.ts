import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ViewMode } from '@/types'

interface Tab {
  id: string
  filePath: string
  fileName: string
  content: string
  isModified: boolean
}

export const useEditorStore = defineStore('editor', () => {
  const content = ref('')
  const currentFile = ref('')
  const viewMode = ref<ViewMode>('split')
  const cursorLine = ref(0)
  const cursorColumn = ref(0)
  const isModified = ref(false)

  const openTabs = ref<Tab[]>([])
  const activeTabId = ref<string | null>(null)

  const setContent = (value: string) => {
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

  const setViewMode = (mode: ViewMode) => {
    viewMode.value = mode
  }

  const setCursor = (line: number, column: number) => {
    cursorLine.value = line
    cursorColumn.value = column
  }

  const markSaved = () => {
    isModified.value = false
    
    if (activeTabId.value) {
      markTabSaved(activeTabId.value)
    }
  }

  const addTab = (filePath: string, content: string) => {
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
      content,
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

  const updateTabContent = (tabId: string, newContent: string) => {
    const tab = openTabs.value.find(t => t.id === tabId)
    if (!tab) return

    tab.content = newContent
    tab.isModified = true

    if (activeTabId.value === tabId) {
      content.value = newContent
      isModified.value = true
    }
  }

  const markTabSaved = (tabId: string) => {
    const tab = openTabs.value.find(t => t.id === tabId)
    if (!tab) return

    tab.isModified = false

    if (activeTabId.value === tabId) {
      isModified.value = false
    }
  }

  const getActiveTab = () => {
    if (!activeTabId.value) return null
    return openTabs.value.find(t => t.id === activeTabId.value) || null
  }

  return {
    content, currentFile, viewMode, cursorLine, cursorColumn, isModified,
    openTabs, activeTabId,
    setContent, setViewMode, setCursor, markSaved,
    addTab, closeTab, switchTab, updateTabContent, markTabSaved, getActiveTab
  }
})
