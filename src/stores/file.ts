import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { FileItem, Workspace } from '@/types'

const isTauri = '__TAURI_INTERNALS__' in window

async function getTauriAPI() {
  if (!isTauri) return null
  const { invoke } = await import('@tauri-apps/api/core')
  const { open } = await import('@tauri-apps/plugin-dialog')
  return { invoke, open }
}

export const useFileStore = defineStore('file', () => {
  const rootPath = ref('')
  const rootName = ref('')
  const files = ref<FileItem[]>([])
  const currentFilePath = ref('')
  const workspaces = ref<Workspace[]>(JSON.parse(localStorage.getItem('workspaces') || '[]'))
  const searchQuery = ref('')
  const searchResults = ref<FileItem[]>([])

  const loadFiles = async (dirPath: string) => {
    if (!isTauri) return
    try {
      const api = await getTauriAPI()
      if (!api) return
      const entries = await api.invoke('read_dir', { path: dirPath }) as any[]
      files.value = entries
        .filter((e: any) => e.name.endsWith('.md') || e.name.endsWith('.markdown') || e.is_dir)
        .map((e: any) => ({
          id: e.path,
          name: e.name,
          path: e.path,
          parentPath: dirPath,
          isDirectory: e.is_dir,
          isMarkdown: e.name.endsWith('.md') || e.name.endsWith('.markdown'),
          modifiedAt: 0,
          size: 0
        }))
    } catch (error) {
      console.error('加载文件失败:', error)
    }
  }

  const openFolder = async () => {
    if (!isTauri) {
      console.warn('打开文件夹功能仅在 Tauri 桌面端可用')
      return
    }
    try {
      const api = await getTauriAPI()
      if (!api) return
      const selected = await api.open({ directory: true, multiple: false, title: '选择工作区文件夹' })
      if (selected) {
        rootPath.value = selected as string
        rootName.value = (selected as string).split('/').pop() || '文件夹'
        await loadFiles(selected as string)
        addWorkspace(selected as string, rootName.value)
      }
    } catch (error) {
      console.error('打开文件夹失败:', error)
    }
  }

  const selectFile = (path: string) => {
    currentFilePath.value = path
  }

  const searchFiles = async (query: string) => {
    searchQuery.value = query
    if (!query.trim()) {
      searchResults.value = []
      return
    }
    const q = query.toLowerCase()
    searchResults.value = files.value.filter(f => f.name.toLowerCase().includes(q))
  }

  const addWorkspace = (path: string, name: string) => {
    const exists = workspaces.value.find(w => w.path === path)
    if (exists) {
      exists.lastOpened = Date.now()
    } else {
      workspaces.value.push({ id: path, name, path, lastOpened: Date.now() })
    }
    localStorage.setItem('workspaces', JSON.stringify(workspaces.value))
  }

  const removeWorkspace = (path: string) => {
    workspaces.value = workspaces.value.filter(w => w.path !== path)
    localStorage.setItem('workspaces', JSON.stringify(workspaces.value))
  }

  return {
    rootPath, rootName, files, currentFilePath, workspaces,
    searchQuery, searchResults,
    openFolder, loadFiles, selectFile, searchFiles, addWorkspace, removeWorkspace
  }
})
