<template>
  <div class="panel">
    <div class="panel-header">
      <span class="panel-title">资源管理器</span>
      <div class="panel-actions" v-if="rootPath">
        <el-button :icon="Upload" native-type="button" size="small" circle aria-label="导入文件" @click="handleImportFile" title="导入文件" />
        <el-button :icon="DocumentAdd" native-type="button" size="small" circle aria-label="新建文件" @click="handleCreateFile" title="新建文件" />
        <el-button :icon="FolderAdd" native-type="button" size="small" circle aria-label="新建文件夹" @click="handleCreateFolder" title="新建文件夹" />
      </div>
    </div>

    <!-- 隐藏的文件输入框 -->
    <input
      ref="fileInputRef"
      type="file"
      multiple
      :accept="supportedFileTypes"
      style="display: none"
      @change="handleFileInputChange"
    />

    <div class="search-bar" v-if="rootPath">
      <el-input
        ref="searchInputRef"
        v-model="searchQuery"
        placeholder="搜索文件..."
        size="small"
        clearable
        :prefix-icon="Search"
        @input="handleSearchInput"
        @keydown.enter="handleSearchEnter"
        @clear="clearSearch"
      >
        <template #append>
          <el-button :icon="Document" native-type="button" size="small" :type="searchMode === 'content' ? 'primary' : 'default'" aria-label="切换搜索模式" @click="toggleSearchMode" title="切换搜索模式" />
        </template>
      </el-input>
      <div class="search-mode-hint">{{ searchMode === 'name' ? '文件名搜索' : (contentSearchMode === 'regex' ? '正则搜索' : '内容搜索') }}</div>
    </div>

    <div class="favorites-section" v-if="!searchQuery && favorites.length > 0 && rootPath">
      <div class="section-label">收藏</div>
      <div class="favorite-list">
        <div v-for="f in favorites" :key="f.path" class="favorite-item">
          <button type="button" class="favorite-open" :aria-label="`打开收藏文件 ${f.name}`" @click="handleFavoriteSelect(f.path)">
            <el-icon :size="14"><Star /></el-icon>
            <span class="favorite-name">{{ f.name }}</span>
          </button>
          <button type="button" class="favorite-remove" :aria-label="`取消收藏 ${f.name}`" @click="removeFavorite(f.path)">×</button>
        </div>
      </div>
      <el-divider style="margin: 8px 0" />
    </div>

    <div class="recent-section" v-if="!searchQuery && recentFiles.length > 0 && rootPath">
      <div class="section-label">最近打开</div>
      <div class="recent-list">
        <div
          v-for="f in recentFiles.slice(0, 5)"
          :key="f.path"
          class="recent-item"
          @click="handleRecentFileSelect(f.path)"
        >
          <el-icon :size="14"><Document /></el-icon>
          <span class="recent-name">{{ f.name }}</span>
        </div>
      </div>
      <el-divider style="margin: 8px 0" />
    </div>

    <div class="search-results" v-if="activeSearchResults.length > 0 && trimmedSearchQuery">
      <div class="search-result-header">找到 {{ activeSearchResults.length }} 个{{ searchMode === 'name' ? '文件' : '结果' }}</div>
      <el-card
        v-for="result in activeSearchResults"
        :key="result.filePath"
        shadow="hover"
        class="search-result-card"
        @click="handleSearchResultClick(result)"
      >
        <div class="result-file-name">{{ result.fileName }}</div>
        <div v-for="(match, idx) in result.matches.slice(0, 3)" :key="idx" class="result-match-line">
          <el-tag size="small" type="info" effect="plain">{{ match.lineNumber || '路径' }}</el-tag>
          <span class="match-content" v-html="highlightMatchContent(match.lineContent)" />
        </div>
      </el-card>
    </div>

    <div class="search-empty" v-else-if="rootPath && trimmedSearchQuery">
      没有找到匹配的{{ searchMode === 'name' ? '文件' : '内容' }}
    </div>

    <div class="file-list" v-else-if="rootPath && treeData.length > 0">
      <el-tree
        :data="treeData"
        :props="treeProps"
        node-key="path"
        highlight-current
        :expand-on-click-node="false"
        @node-click="handleNodeClick"
        :default-expanded-keys="expandedKeys"
      >
        <template #default="{ node, data }">
          <el-dropdown trigger="contextmenu" class="tree-node-menu" @command="(cmd: string) => handleTreeAction(cmd, data)">
            <span class="tree-node" :class="{ 'is-selected': fileSelection.isSelected(data.path) }" :data-file-path="data.path" :aria-label="`${data.isDirectory ? '打开文件夹' : '打开文件'} ${node.label}`">
              <button
                type="button"
                class="tree-node-select"
                :class="{ active: fileSelection.isSelected(data.path) }"
                :aria-label="`选择 ${node.label}`"
                :aria-pressed="fileSelection.isSelected(data.path)"
                @click.stop="fileSelection.handleNodeSelection(data.path, $event)"
              >
                <span v-if="fileSelection.isSelected(data.path)" class="select-check">✓</span>
              </button>
              <el-icon v-if="data.isDirectory" :size="14"><Folder /></el-icon>
              <el-icon v-else-if="data.name.endsWith('.json')" :size="14" color="var(--warning)"><Document /></el-icon>
              <el-icon v-else-if="data.name.endsWith('.png') || data.name.endsWith('.jpg')" :size="14" color="var(--accent-green)"><Picture /></el-icon>
              <el-icon v-else :size="14" color="var(--obsidian-accent)"><Document /></el-icon>
              <span class="tree-node-label">{{ node.label }}</span>
              <button
                v-if="!data.isDirectory"
                type="button"
                class="tree-node-favorite"
                :class="{ active: isFavorite(data.path) }"
                :aria-label="isFavorite(data.path) ? `取消收藏 ${node.label}` : `收藏 ${node.label}`"
                @click.stop="toggleFavorite(data.path)"
              >★</button>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item v-if="!data.isDirectory" command="favorite">{{ isFavorite(data.path) ? '取消收藏' : '收藏' }}</el-dropdown-item>
                <el-dropdown-item command="rename">重命名</el-dropdown-item>
                <el-dropdown-item command="delete" divided>删除</el-dropdown-item>
                <el-dropdown-item command="import" v-if="!data.isDirectory">
                  <el-icon><Upload /></el-icon> 导入到知识库
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </template>
      </el-tree>
    </div>

    <div v-if="fileSelection.selectedCount > 0" class="batch-toolbar" role="toolbar" aria-label="批量文件操作">
      <span class="batch-count">已选 {{ fileSelection.selectedCount }} 项</span>
      <el-button size="small" type="danger" plain native-type="button" aria-label="批量删除选中文件" @click="handleBatchDelete">删除</el-button>
      <el-button size="small" plain native-type="button" aria-label="批量移动选中文件" @click="handleBatchMove">移动</el-button>
      <el-button size="small" text native-type="button" aria-label="清空文件选择" @click="fileSelection.clearSelection()">清空</el-button>
    </div>

    <div class="empty-folder" v-else-if="rootPath && treeData.length === 0">
      <el-icon :size="28" color="var(--obsidian-text-faint)"><FolderAdd /></el-icon>
      <span>此文件夹为空</span>
      <el-button size="small" native-type="button" @click="handleCreateFile">创建新文件</el-button>
    </div>

    <div class="empty-prompt" v-else>
      <el-empty description="选择工作区" :image-size="48">
        <el-button type="primary" native-type="button" @click="openFolder">
          <el-icon><FolderAdd /></el-icon>
          打开文件夹
        </el-button>
        <p class="empty-hint">或使用浏览器内置虚拟文件系统</p>
        <el-button size="small" native-type="button" @click="initDemoWorkspace">试用示例工作区</el-button>
      </el-empty>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Folder, Document, DocumentAdd, FolderAdd, Search, Picture, Upload, Star } from '@element-plus/icons-vue'
import { vaultService } from '../../services/vault'
import { knowledgeIndex } from '../../services/knowledgeIndex'
import { sanitizeFilePath, isValidFileName, safeStorage, sanitizeMarkdown } from '../../utils/security'
import { fileImporter } from '../../services/fileImporter'
import { useFileSearch } from '../../composables/useFileSearch'
import { recentFilesService, type RecentFileEntry } from '../../services/recentFiles'
import { useFavorites } from '../../composables/useFavorites'
import { useFileSelectionStore } from '../../stores/fileSelection'
import { deletePathsSequential, movePathsSequential, type BatchFileResult } from '../../services/fileBatch'
import type { TreeNode } from '../../types'

// 支持导入的文件类型
const SUPPORTED_IMPORT_TYPES = ['.md', '.markdown', '.txt', '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp']

const WORKSPACE_ROOT_STORAGE_KEY = 'workspace_root_path'

const emit = defineEmits<{
  (e: 'select', path: string): void
  (e: 'search-result-select', payload: { path: string; lineNumber?: number }): void
  (e: 'root-path-change', path: string): void
  (e: 'renamed', payload: { oldPath: string; newPath: string; isDirectory: boolean; renamedPaths?: Array<{ oldPath: string; newPath: string; isDirectory: boolean }>; updatedLinkPaths?: string[] }): void
  (e: 'deleted', payload: { path: string; isDirectory: boolean }): void
  (e: 'imported', payload: { path: string; notePath?: string }): void
}>()

// 文件导入相关
const fileInputRef = ref<HTMLInputElement | null>(null)
const supportedFileTypes = computed(() => SUPPORTED_IMPORT_TYPES.join(','))

const rootPath = ref(safeStorage.get<string>(WORKSPACE_ROOT_STORAGE_KEY, ''))
const treeData = ref<TreeNode[]>([])
const expandedKeys = ref<string[]>([])
const currentFilePath = ref('')
let isDisposed = false
let treeLoadRequestId = 0

const recentFiles = ref<RecentFileEntry[]>([])
const fileSelection = useFileSelectionStore()
const { favorites, removeFavorite, toggleFavorite, isFavorite } = useFavorites()

const {
  searchQuery,
  searchMode,
  contentSearchMode,
  trimmedSearchQuery,
  activeSearchResults,
  toggleSearchMode,
  clearSearch,
  searchFileNames,
  searchContent,
  handleSearchInput,
  handleSearchEnter,
  cancelPendingSearches,
} = useFileSearch({
  rootPath: () => rootPath.value,
  isDisposed: () => isDisposed,
})

const searchInputRef = ref<{ focus: () => void } | null>(null)

const addRecentFile = (path: string) => {
  recentFiles.value = recentFilesService.addRecentFile(path)
}

const loadRecentFiles = async () => {
  recentFiles.value = await recentFilesService.validateRecentFiles()
}

const handleRecentFileSelect = async (path: string) => {
  try {
    await vaultService.readFile(path)
    emit('select', path)
  } catch {
    recentFiles.value = recentFilesService.removeRecentFile(path)
    ElMessage.warning('最近文件不存在，已从列表移除')
  }
}

const handleFavoriteSelect = async (path: string) => {
  try {
    await vaultService.readFile(path)
    emit('select', path)
    addRecentFile(path)
  } catch {
    removeFavorite(path)
    ElMessage.warning('收藏文件不存在，已从列表移除')
  }
}

const treeProps = {
  children: 'children',
  label: 'name',
  isLeaf: (data: TreeNode) => !data.isDirectory
}

const loadTreeFromFS = async () => {
  const requestId = ++treeLoadRequestId
  const activeRootPath = rootPath.value
  if (!activeRootPath) return
  try {
    const children = await vaultService.readDirectory(activeRootPath)
    if (isDisposed || requestId !== treeLoadRequestId || rootPath.value !== activeRootPath) return
    treeData.value = buildTree(children)
    expandedKeys.value = [activeRootPath]
    syncVisibleSelectionPaths()
  } catch (e: any) {
    if (isDisposed || requestId !== treeLoadRequestId) return
    ElMessage.error('加载目录失败: ' + e.message)
  }
}

const flattenLoadedTreePaths = (nodes: TreeNode[]): string[] => {
  const paths: string[] = []
  const visit = (items: TreeNode[]) => {
    for (const item of items) {
      paths.push(item.path)
      if (item.isExpanded && item.children?.length) visit(item.children)
    }
  }
  visit(nodes)
  return paths
}

const syncVisibleSelectionPaths = () => {
  fileSelection.setVisiblePaths(flattenLoadedTreePaths(treeData.value))
}

const setRootPath = (path: string) => {
  rootPath.value = path
  safeStorage.set(WORKSPACE_ROOT_STORAGE_KEY, path)
  emit('root-path-change', path)
}

const buildTree = (items: any[]): TreeNode[] => {
  return items
    .filter(i => i.isDirectory || i.name.endsWith('.md') || i.name.endsWith('.markdown'))
    .sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    .map(i => ({
      id: i.path,
      name: i.name,
      path: i.path,
      parentPath: i.parentPath,
      isDirectory: i.isDirectory,
      isMarkdown: !i.isDirectory && (i.name.endsWith('.md') || i.name.endsWith('.markdown')),
      children: i.isDirectory ? [] : undefined,
      isExpanded: false
    }))
}

const expandTreeNode = async (data: TreeNode, node?: any) => {
  if (!expandedKeys.value.includes(data.path)) {
    expandedKeys.value = [...expandedKeys.value, data.path]
  }
  await nextTick()
  data.isExpanded = true
  if (node) {
    if (typeof node.expand === 'function') node.expand()
    else node.expanded = true
  }
  syncVisibleSelectionPaths()
}

const handleNodeClick = async (data: TreeNode, node?: any) => {
  if (data.isDirectory) {
    if (!data.children || data.children.length === 0) {
      try {
        const children = await vaultService.readDirectory(data.path)
        if (isDisposed) return
        data.children = buildTree(children)
        data.isExpanded = true
        await expandTreeNode(data, node)
      } catch (e: any) {
        ElMessage.error('加载目录失败')
      }
    } else {
      await expandTreeNode(data, node)
    }
  } else {
    currentFilePath.value = data.path
    emit('select', data.path)
    addRecentFile(data.path)
  }
}

const handleTreeAction = async (command: string, data: TreeNode) => {
  if (command === 'favorite') {
    toggleFavorite(data.path)
  } else if (command === 'delete') {
    try {
      const message = data.isDirectory
        ? `确定要删除文件夹 ${data.name} 及其所有内容吗？此操作不可撤销。`
        : `确定要删除文件 ${data.name} 吗？此操作不可撤销。`
      await ElMessageBox.confirm(message, '删除确认', {
        type: 'warning',
        confirmButtonText: '确定',
        cancelButtonText: '取消'
      })
      await vaultService.deletePath(data.path)
      if (isDisposed) return
      await loadTreeFromFS()
      if (currentFilePath.value === data.path) currentFilePath.value = ''
      emit('deleted', { path: data.path, isDirectory: data.isDirectory })
      ElMessage.success('已删除')
    } catch (e: any) {
      if (e !== 'cancel' && e !== 'close') ElMessage.error(e?.message || '删除失败')
    }
  } else if (command === 'rename') {
    try {
      const { value } = await ElMessageBox.prompt('输入新名称', '重命名', { inputValue: data.name, confirmButtonText: '确定', cancelButtonText: '取消' })
      if (value && value !== data.name) {
        if (!isValidFileName(value)) {
          ElMessage.warning('文件名无效：不能包含路径分隔符、不能以点开头、不能包含控制字符')
          return
        }
        const parentPath = data.path.substring(0, data.path.lastIndexOf('/'))
        const newPath = sanitizeFilePath(`${parentPath}/${value}`)
        const renameResult = await vaultService.renamePath(data.path, newPath)
        if (isDisposed) return
        await loadTreeFromFS()
        if (currentFilePath.value === data.path) currentFilePath.value = newPath
        emit('renamed', {
          oldPath: data.path,
          newPath,
          isDirectory: data.isDirectory,
          renamedPaths: renameResult.renamedPaths,
          updatedLinkPaths: renameResult.updatedLinkPaths,
        })
        ElMessage.success(renameResult.updatedLinkPaths.length > 0 ? `已重命名并更新 ${renameResult.updatedLinkPaths.length} 个链接` : '已重命名')
      }
    } catch (e: any) {
      if (e !== 'cancel' && e !== 'close') ElMessage.error(e?.message || '重命名失败')
    }
  } else if (command === 'import') {
    // 导入文件到知识库
    await handleImportExternalFile(data.path)
  }
}

const summarizeBatchResult = (action: string, result: BatchFileResult) => {
  if (result.failed.length === 0) {
    ElMessage.success(`${action} ${result.succeeded.length} 项`)
    return
  }
  if (result.succeeded.length > 0) {
    ElMessage.warning(`${action}完成 ${result.succeeded.length} 项，失败 ${result.failed.length} 项：${result.failed[0].error}`)
    return
  }
  ElMessage.error(`${action}失败：${result.failed[0]?.error || '未知错误'}`)
}

const handleBatchDelete = async () => {
  const paths = [...fileSelection.selectedPathList]
  if (paths.length === 0) return
  try {
    await ElMessageBox.confirm(`确定要删除选中的 ${paths.length} 项吗？此操作不可撤销。`, '批量删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
    const result = await deletePathsSequential(paths)
    if (isDisposed) return
    await loadTreeFromFS()
    fileSelection.removeSelected(result.succeeded)
    result.succeeded.forEach(path => removeFavorite(path))
    summarizeBatchResult('已删除', result)
  } catch (e: any) {
    if (e !== 'cancel' && e !== 'close') ElMessage.error(e?.message || '批量删除失败')
  }
}

const handleBatchMove = async () => {
  const paths = [...fileSelection.selectedPathList]
  if (paths.length === 0) return
  try {
    const { value } = await ElMessageBox.prompt('输入目标文件夹路径', '批量移动', {
      inputValue: rootPath.value,
      confirmButtonText: '移动',
      cancelButtonText: '取消'
    })
    const targetDirectory = sanitizeFilePath(value || '')
    if (!targetDirectory) {
      ElMessage.warning('目标文件夹路径不能为空')
      return
    }
    const result = await movePathsSequential(paths, targetDirectory)
    if (isDisposed) return
    await loadTreeFromFS()
    fileSelection.removeSelected(result.succeeded)
    result.succeeded.forEach(path => removeFavorite(path))
    summarizeBatchResult('已移动', result)
  } catch (e: any) {
    if (e !== 'cancel' && e !== 'close') ElMessage.error(e?.message || '批量移动失败')
  }
}

// 导入外部文件到知识库
const handleImportExternalFile = async (filePath: string) => {
  try {
    const result = await fileImporter.importExternalFile(filePath, rootPath.value)
    if (result.success) {
      await loadTreeFromFS()
      ElMessage.success(result.message || '已导入到知识库')
      emit('imported', { path: filePath, notePath: result.notePath })
    } else {
      ElMessage.warning(result.message || '导入失败')
    }
  } catch (e: any) {
    ElMessage.error('导入失败: ' + e.message)
  }
}

// 点击导入按钮
const handleImportFile = () => {
  fileInputRef.value?.click()
}

// 处理文件输入变化
const handleFileInputChange = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const files = input.files
  if (!files || files.length === 0) return

  let successCount = 0
  let failCount = 0

  for (const file of Array.from(files)) {
    try {
      const result = await fileImporter.importFile(file, rootPath.value)
      if (result.success) {
        successCount++
      } else {
        failCount++
      }
    } catch {
      failCount++
    }
  }

  await loadTreeFromFS()

  if (successCount > 0) {
    ElMessage.success(`成功导入 ${successCount} 个文件${failCount > 0 ? `，失败 ${failCount} 个` : ''}`)
  } else if (failCount > 0) {
    ElMessage.error(`导入失败 ${failCount} 个文件`)
  }

  // 清空 input 以允许重复选择相同文件
  input.value = ''
}

const openFolder = async () => {
  try {
    const count = await vaultService.importFromPicker()
    if (isDisposed) return
    if (count > 0) {
      setRootPath('/workspace')
      await loadTreeFromFS()
      ElMessage.success(`已导入 ${count} 个文件`)
    }
  } catch (e: any) {
    if (e.name !== 'AbortError') ElMessage.error('导入失败: ' + e.message)
  }
}

const initDemoWorkspace = async () => {
  await vaultService.useIndexedDbWorkspace()
  if (isDisposed) return
  setRootPath('/workspace')
  await loadTreeFromFS()
  if (isDisposed) return
  ElMessage.success('已加载示例工作区')
}

const handleCreateFile = async () => {
  try {
    const { value } = await ElMessageBox.prompt('输入文件名', '新建文件', { inputValue: 'untitled.md', confirmButtonText: '创建', cancelButtonText: '取消' })
    if (value) {
      if (!isValidFileName(value)) {
        ElMessage.warning('文件名无效：不能包含路径分隔符、不能以点开头、不能包含控制字符')
        return
      }
      const name = value.endsWith('.md') ? value : value + '.md'
      const path = sanitizeFilePath(`${rootPath.value}/${name}`)
      await vaultService.createFile(path)
      if (isDisposed) return
      await loadTreeFromFS()
      currentFilePath.value = path
      emit('select', path)
      ElMessage.success('文件已创建')
    }
  } catch (e: any) {
    if (e !== 'cancel' && e !== 'close') ElMessage.error(e?.message || '创建文件失败')
  }
}

const handleCreateFolder = async () => {
  try {
    const { value } = await ElMessageBox.prompt('输入文件夹名', '新建文件夹', { confirmButtonText: '创建', cancelButtonText: '取消' })
    if (value) {
      if (!isValidFileName(value)) {
        ElMessage.warning('文件夹名无效：不能包含路径分隔符、不能以点开头、不能包含控制字符')
        return
      }
      const path = sanitizeFilePath(`${rootPath.value}/${value}`)
      await vaultService.createDirectory(path)
      if (isDisposed) return
      await loadTreeFromFS()
      ElMessage.success('文件夹已创建')
    }
  } catch (e: any) {
    if (e !== 'cancel' && e !== 'close') ElMessage.error(e?.message || '创建文件夹失败')
  }
}

const focusSearch = async (mode: 'name' | 'content', query = '') => {
  searchMode.value = mode
  searchQuery.value = query
  clearSearch()
  searchQuery.value = query
  await nextTick()
  searchInputRef.value?.focus()
  if (mode === 'content' && query.trim()) await searchContent()
  if (mode === 'name' && query.trim()) await searchFileNames()
}

const handleSearchResultClick = (result: { filePath: string; fileName: string; matches: Array<{ lineNumber?: number; lineContent: string }> }) => {
  const lineNumber = result.matches.find(match => match.lineNumber)?.lineNumber
  emit('search-result-select', { path: result.filePath, lineNumber })
  clearSearch()
}

const highlightMatchContent = (content: string): string => {
  const query = trimmedSearchQuery.value.trim()
  if (!query) return sanitizeMarkdown(content)
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const highlighted = content.replace(new RegExp(`(${escaped})`, 'gi'), '<mark>$1</mark>')
  return sanitizeMarkdown(highlighted)
}

const readFile = async (filePath: string): Promise<string> => {
  return vaultService.readFileOrEmpty(filePath)
}

const saveFile = async (filePath: string, content: string): Promise<boolean> => {
  try { await vaultService.writeFile(filePath, content); return true } catch { return false }
}

defineExpose({ readFile, saveFile, handleCreateFile, handleCreateFolder, openFolder, initDemoWorkspace, refreshTree: loadTreeFromFS, focusSearch, rootPath })

onMounted(async () => {
  await loadRecentFiles()
  if (rootPath.value) {
    emit('root-path-change', rootPath.value)
    await loadTreeFromFS()
  }
})

onUnmounted(() => {
  isDisposed = true
  treeLoadRequestId += 1
  cancelPendingSearches()
})
</script>

<style scoped>
.search-bar {
  padding: 6px 8px;
  border-bottom: 1px solid var(--obsidian-border, rgba(255, 255, 255, 0.06));
}

.search-bar :deep(.el-input__wrapper) {
  background: var(--obsidian-bg-primary, #1e1e1e) !important;
  box-shadow: none !important;
  border: 1px solid var(--obsidian-border, rgba(255, 255, 255, 0.06)) !important;
  border-radius: 4px;
}

.search-bar :deep(.el-input__wrapper:hover) {
  border-color: rgba(255, 255, 255, 0.1) !important;
}

.search-bar :deep(.el-input__wrapper.is-focus) {
  border-color: var(--obsidian-accent, #7f6df2) !important;
}

.search-bar :deep(.el-input__inner) {
  color: var(--obsidian-text-normal, #dcddde) !important;
}

.search-bar :deep(.el-input__inner::placeholder) {
  color: var(--obsidian-text-faint, #666) !important;
}

.search-bar :deep(.el-input-group__append) {
  background: var(--obsidian-bg-primary, #1e1e1e) !important;
  border-color: var(--obsidian-border, rgba(255, 255, 255, 0.06)) !important;
  box-shadow: none !important;
}

.search-mode-hint {
  font-size: 10px;
  color: var(--obsidian-text-faint, #666);
  text-align: center;
  margin-top: 3px;
}

.search-results {
  padding: 4px 8px;
  max-height: 300px;
  overflow-y: auto;
}

.search-result-header {
  font-size: 10px;
  font-weight: 600;
  color: var(--obsidian-text-faint, #666);
  text-transform: uppercase;
  letter-spacing: 0;
  padding: 4px 8px;
}

.search-empty {
  padding: 18px 12px;
  color: var(--obsidian-text-faint, #666);
  font-size: 12px;
  text-align: center;
}

.search-result-card {
  margin-bottom: 2px;
  cursor: pointer;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
}

.search-result-card :deep(.el-card__body) {
  padding: 6px 8px;
}

.search-result-card:hover {
  background: var(--obsidian-bg-hover, #303030) !important;
  border-radius: 4px;
}

.result-file-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--obsidian-text-normal, #dcddde);
  margin-bottom: 2px;
}

.result-match-line {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--obsidian-text-muted, #999);
  margin-top: 1px;
}

.match-content {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.match-content :deep(mark) {
  background: var(--obsidian-accent-soft);
  color: var(--obsidian-accent);
  padding: 0 2px;
  border-radius: 2px;
}

.file-list {
  flex: 1;
  overflow-y: auto;
  padding: 2px 0;
}

.file-list :deep(.el-tree) {
  background: transparent !important;
  --el-tree-node-hover-bg-color: var(--obsidian-bg-hover, #303030);
}

.file-list :deep(.el-tree-node__content) {
  height: 28px;
  border-radius: 0;
}

.file-list :deep(.el-tree-node__content:hover) {
  background: var(--obsidian-bg-hover, #303030);
}

.file-list :deep(.el-tree-node.is-current > .el-tree-node__content) {
  background: var(--obsidian-bg-active, #363636);
}

.file-list :deep(.el-tree-node__expand-icon) {
  color: var(--obsidian-text-faint, #666);
}

.tree-node-menu {
  display: flex;
  flex: 1;
  min-width: 0;
}

.tree-node {
  display: flex;
  align-items: center;
  gap: 5px;
  flex: 1;
  overflow: hidden;
  font-size: 13px;
  color: var(--obsidian-text-normal, #dcddde);
}

.tree-node.is-selected {
  color: var(--obsidian-accent, #7f6df2);
}

.tree-node-select,
.tree-node-favorite,
.favorite-remove {
  border: 0;
  background: transparent;
  color: var(--obsidian-text-faint, #666);
  cursor: pointer;
  line-height: 1;
}

.tree-node-select {
  width: 12px;
  height: 12px;
  flex: 0 0 auto;
  border: 1px solid var(--obsidian-border, rgba(255, 255, 255, 0.06));
  border-radius: 3px;
  padding: 0;
}

.tree-node-select.active {
  background: var(--obsidian-accent, #7f6df2);
  border-color: var(--obsidian-accent, #7f6df2);
}

.tree-node-select:focus-visible {
  outline: 2px solid var(--obsidian-accent, #7f6df2);
  outline-offset: 2px;
}

.tree-node-favorite {
  margin-left: auto;
  opacity: 0;
  padding: 0 4px;
}

.tree-node:hover .tree-node-favorite,
.tree-node-favorite.active {
  opacity: 1;
}

.tree-node-favorite.active {
  color: var(--obsidian-accent, #7f6df2);
}

.tree-node-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: var(--obsidian-text-normal, #dcddde);
}

.empty-folder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px 16px;
  color: var(--obsidian-text-muted, #999);
  font-size: 12px;
}

.empty-prompt {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 32px;
}

.empty-prompt :deep(.el-empty__description p) {
  color: var(--obsidian-text-faint, #666);
}

.empty-hint {
  font-size: 11px;
  color: var(--obsidian-text-faint, #666);
  margin-top: 8px;
}

.section-label {
  padding: 6px 12px 3px;
}

.recent-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 12px;
  cursor: pointer;
  font-size: 13px;
  color: var(--obsidian-text-muted, #999);
  transition: background 0.1s ease;
  border-radius: 0;
}

.recent-item:hover {
  background: var(--obsidian-bg-hover, #303030);
  color: var(--obsidian-text-normal, #dcddde);
}

.recent-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recent-item :deep(.el-icon) {
  color: var(--obsidian-text-faint, #666);
}

.favorite-item {
  display: flex;
  align-items: center;
  padding: 2px 8px 2px 12px;
  gap: 4px;
}

.favorite-open {
  min-width: 0;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  border: 0;
  background: transparent;
  color: var(--obsidian-text-muted, #999);
  cursor: pointer;
  padding: 2px 0;
  text-align: left;
}

.favorite-open:hover {
  color: var(--obsidian-text-normal, #dcddde);
}

.favorite-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}

.favorite-remove {
  width: 20px;
  height: 20px;
  border-radius: 4px;
}

.favorite-remove:hover {
  background: var(--obsidian-bg-hover, #303030);
  color: var(--obsidian-text-normal, #dcddde);
}

.batch-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px;
  border-top: 1px solid var(--obsidian-border, rgba(255, 255, 255, 0.06));
  background: var(--obsidian-bg-secondary, #252525);
  flex-shrink: 0;
}

.batch-count {
  margin-right: auto;
  color: var(--obsidian-text-muted, #999);
  font-size: 12px;
}
</style>
