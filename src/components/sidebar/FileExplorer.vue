<template>
  <div class="panel">
    <div class="panel-header">
      <span class="panel-title">资源管理器</span>
      <div class="panel-actions" v-if="rootPath">
        <el-button :icon="DocumentAdd" size="small" circle aria-label="新建文件" @click="handleCreateFile" title="新建文件" />
        <el-button :icon="FolderAdd" size="small" circle aria-label="新建文件夹" @click="handleCreateFolder" title="新建文件夹" />
      </div>
    </div>

    <div class="search-bar" v-if="rootPath">
      <el-input
        v-model="searchQuery"
        placeholder="搜索文件..."
        size="small"
        clearable
        :prefix-icon="Search"
        @keydown.enter="searchContent"
        @clear="clearSearch"
      >
        <template #append>
          <el-button :icon="Document" size="small" :type="searchMode === 'content' ? 'primary' : 'default'" @click="toggleSearchMode" title="切换搜索模式" />
        </template>
      </el-input>
      <div class="search-mode-hint">{{ searchMode === 'name' ? '文件名搜索' : '内容搜索' }}</div>
    </div>

    <div class="recent-section" v-if="!searchQuery && recentFiles.length > 0 && rootPath">
      <div class="section-label">最近打开</div>
      <div class="recent-list">
        <div
          v-for="f in recentFiles.slice(0, 5)"
          :key="f.path"
          class="recent-item"
          @click="emit('select', f.path)"
        >
          <el-icon :size="14"><Document /></el-icon>
          <span class="recent-name">{{ f.name }}</span>
        </div>
      </div>
      <el-divider style="margin: 8px 0" />
    </div>

    <div class="search-results" v-if="searchResults.length > 0 && searchQuery">
      <div class="search-result-header">找到 {{ searchResults.length }} 个结果</div>
      <el-card
        v-for="result in searchResults"
        :key="result.filePath"
        shadow="hover"
        class="search-result-card"
        @click="handleSearchResultClick(result)"
      >
        <div class="result-file-name">{{ result.fileName }}</div>
        <div v-for="(match, idx) in result.matches.slice(0, 3)" :key="idx" class="result-match-line">
          <el-tag size="small" type="info" effect="plain">{{ match.lineNumber }}</el-tag>
          <span class="match-content">{{ match.lineContent }}</span>
        </div>
      </el-card>
    </div>

    <div class="file-list" v-if="rootPath && (!searchQuery || searchResults.length === 0)">
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
            <span class="tree-node" :data-file-path="data.path">
              <el-icon v-if="data.isDirectory" :size="14"><Folder /></el-icon>
              <el-icon v-else-if="data.name.endsWith('.json')" :size="14" color="var(--el-color-warning)"><Document /></el-icon>
              <el-icon v-else-if="data.name.endsWith('.png') || data.name.endsWith('.jpg')" :size="14" color="var(--el-color-success)"><Picture /></el-icon>
              <el-icon v-else :size="14" color="var(--el-color-primary)"><Document /></el-icon>
              <span class="tree-node-label">{{ node.label }}</span>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="rename">重命名</el-dropdown-item>
                <el-dropdown-item command="delete" divided>删除</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </template>
      </el-tree>
    </div>

    <div class="empty-prompt" v-else>
      <el-empty description="选择工作区" :image-size="48">
        <el-button type="primary" @click="openFolder">
          <el-icon><FolderAdd /></el-icon>
          打开文件夹
        </el-button>
        <p class="empty-hint">或使用浏览器内置虚拟文件系统</p>
        <el-button size="small" @click="initDemoWorkspace">试用示例工作区</el-button>
      </el-empty>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Folder, Document, DocumentAdd, FolderAdd, Search, Picture } from '@element-plus/icons-vue'
import { fileSystem } from '../../services/fileSystem'
import { sanitizeFilePath, isValidFileName, safeStorage } from '../../utils/security'
import type { TreeNode } from '../../types'

const emit = defineEmits<{
  (e: 'select', path: string): void
  (e: 'root-path-change', path: string): void
  (e: 'renamed', payload: { oldPath: string; newPath: string; isDirectory: boolean }): void
  (e: 'deleted', payload: { path: string; isDirectory: boolean }): void
}>()

const rootPath = ref('')
const treeData = ref<TreeNode[]>([])
const expandedKeys = ref<string[]>([])
const currentFilePath = ref('')

const recentFiles = ref<Array<{ name: string; path: string }>>([])

const addRecentFile = (path: string) => {
  const name = path.split('/').pop() || ''
  recentFiles.value = [
    { name, path },
    ...recentFiles.value.filter(f => f.path !== path)
  ].slice(0, 10)
  safeStorage.set('recent_files', recentFiles.value)
}

const loadRecentFiles = () => {
  const stored = safeStorage.get<Array<{ name: string; path: string }>>('recent_files', [])
  recentFiles.value = stored.filter(file => file.name && file.path).slice(0, 10)
}

const treeProps = {
  children: 'children',
  label: 'name',
  isLeaf: (data: TreeNode) => !data.isDirectory
}

const loadTreeFromFS = async () => {
  if (!rootPath.value) return
  try {
    const children = await fileSystem.readDirectory(rootPath.value)
    treeData.value = buildTree(children)
    expandedKeys.value = [rootPath.value]
  } catch (e: any) {
    ElMessage.error('加载目录失败: ' + e.message)
  }
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
  if (node) {
    if (typeof node.expand === 'function') node.expand()
    else node.expanded = true
  }
}

const handleNodeClick = async (data: TreeNode, node?: any) => {
  if (data.isDirectory) {
    if (!data.children || data.children.length === 0) {
      try {
        const children = await fileSystem.readDirectory(data.path)
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
  if (command === 'delete') {
    try {
      await ElMessageBox.confirm(`确定删除 "${data.name}" 吗？`, '删除确认', {
        type: 'warning',
        confirmButtonText: '确定',
        cancelButtonText: '取消'
      })
      await fileSystem.deleteFile(data.path)
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
        await fileSystem.renameFile(data.path, newPath)
        await loadTreeFromFS()
        if (currentFilePath.value === data.path) currentFilePath.value = newPath
        emit('renamed', { oldPath: data.path, newPath, isDirectory: data.isDirectory })
        ElMessage.success('已重命名')
      }
    } catch (e: any) {
      if (e !== 'cancel' && e !== 'close') ElMessage.error(e?.message || '重命名失败')
    }
  }
}

const openFolder = async () => {
  try {
    const count = await fileSystem.importFromPicker()
    if (count > 0) {
      rootPath.value = '/workspace'
      await loadTreeFromFS()
      emit('root-path-change', rootPath.value)
      ElMessage.success(`已导入 ${count} 个文件`)
    }
  } catch (e: any) {
    if (e.name !== 'AbortError') ElMessage.error('导入失败: ' + e.message)
  }
}

const initDemoWorkspace = async () => {
  await fileSystem.init()
  rootPath.value = '/workspace'
  await loadTreeFromFS()
  emit('root-path-change', rootPath.value)
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
      await fileSystem.createFile(path)
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
      await fileSystem.createDirectory(path)
      await loadTreeFromFS()
      ElMessage.success('文件夹已创建')
    }
  } catch (e: any) {
    if (e !== 'cancel' && e !== 'close') ElMessage.error(e?.message || '创建文件夹失败')
  }
}

const searchQuery = ref('')
const searchMode = ref<'name' | 'content'>('name')
const searchResults = ref<Array<{ filePath: string; fileName: string; matches: Array<{ lineNumber: number; lineContent: string }> }>>([])

const toggleSearchMode = () => {
  searchMode.value = searchMode.value === 'name' ? 'content' : 'name'
  if (searchMode.value === 'content' && searchQuery.value) searchContent()
}

const clearSearch = () => { searchQuery.value = ''; searchResults.value = [] }

const searchContent = async () => {
  if (!searchQuery.value.trim() || !rootPath.value) return
  try {
    searchResults.value = await fileSystem.searchFiles(searchQuery.value)
  } catch (e: any) {
    ElMessage.error('搜索失败')
  }
}

const handleSearchResultClick = (result: { filePath: string }) => {
  emit('select', result.filePath)
  clearSearch()
}

const readFile = async (filePath: string): Promise<string> => {
  return fileSystem.readFileOrEmpty(filePath)
}

const saveFile = async (filePath: string, content: string): Promise<boolean> => {
  try { await fileSystem.writeFile(filePath, content); return true } catch { return false }
}

defineExpose({ readFile, saveFile, handleCreateFile, handleCreateFolder, openFolder, initDemoWorkspace, rootPath })

onMounted(() => {
  loadRecentFiles()
})
</script>

<style scoped>
.panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--obsidian-bg-secondary, #252525);
}

.panel-header {
  padding: 10px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--obsidian-border, rgba(255, 255, 255, 0.06));
  flex-shrink: 0;
}

.panel-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--obsidian-text-muted, #999);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.panel-actions {
  display: flex;
  gap: 2px;
}

.panel-actions :deep(.el-button) {
  background: transparent !important;
  border: none !important;
  color: var(--obsidian-text-faint, #666) !important;
}

.panel-actions :deep(.el-button:hover) {
  color: var(--obsidian-text-normal, #dcddde) !important;
  background: var(--obsidian-bg-hover, #303030) !important;
}

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
  letter-spacing: 0.5px;
  padding: 4px 8px;
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

.tree-node-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: var(--obsidian-text-normal, #dcddde);
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
  font-size: 10px;
  font-weight: 600;
  color: var(--obsidian-text-faint, #666);
  text-transform: uppercase;
  letter-spacing: 0.5px;
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
</style>
