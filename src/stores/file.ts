import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { FileItem, TreeNode } from '@/types'
import { fileSystem, type FileRecord } from '@/services/fileSystem'

function recordToFileItem(record: FileRecord): FileItem {
  return {
    id: String(record.id),
    name: record.name,
    path: record.path,
    parentPath: record.parentPath,
    isDirectory: record.isDirectory,
    isMarkdown: !record.isDirectory && (record.name.endsWith('.md') || record.name.endsWith('.markdown')),
    modifiedAt: record.updatedAt,
    size: record.size,
  }
}

function buildTree(items: FileItem[], parentPath: string): TreeNode[] {
  return items
    .filter(item => item.parentPath === parentPath)
    .sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    .map(item => ({
      id: item.id,
      name: item.name,
      path: item.path,
      isDirectory: item.isDirectory,
      isMarkdown: item.isMarkdown,
      children: item.isDirectory ? buildTree(items, item.path) : undefined,
    }))
}

export const useFileStore = defineStore('file', () => {
  const files = ref<FileItem[]>([])
  const tree = ref<TreeNode[]>([])
  const currentPath = ref('/')
  const loading = ref(false)

  const loadFiles = async (path: string = '/') => {
    loading.value = true
    try {
      const records = await fileSystem.readDirectory(path)
      files.value = records.map(recordToFileItem)
      tree.value = buildTree(files.value, path)
      currentPath.value = path
    } finally {
      loading.value = false
    }
  }

  const refreshTree = async () => {
    const allRecords = await fileSystem.readDirectory(currentPath.value)
    files.value = allRecords.map(recordToFileItem)
    tree.value = buildTree(files.value, currentPath.value)
  }

  const createFile = async (path: string) => {
    await fileSystem.createFile(path)
    await refreshTree()
  }

  const createDirectory = async (path: string) => {
    await fileSystem.createDirectory(path)
    await refreshTree()
  }

  const deleteFile = async (path: string) => {
    await fileSystem.deleteFile(path)
    await refreshTree()
  }

  const renameFile = async (oldPath: string, newPath: string) => {
    await fileSystem.renameFile(oldPath, newPath)
    await refreshTree()
  }

  const readFile = async (path: string): Promise<string> => {
    return fileSystem.readFile(path)
  }

  const writeFile = async (path: string, content: string) => {
    await fileSystem.writeFile(path, content)
    await refreshTree()
  }

  return {
    files, tree, currentPath, loading,
    loadFiles, refreshTree, createFile, createDirectory,
    deleteFile, renameFile, readFile, writeFile,
  }
})
