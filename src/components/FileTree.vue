<template>
  <div class="file-tree">
    <div class="tree-header">
      <span class="tree-title">EXPLORER</span>
      <button class="tree-action" @click="openFolder" title="打开文件夹">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>
      </button>
    </div>
    
    <div class="tree-content" v-if="rootPath">
      <div class="tree-item folder" @click="toggleFolder('root')">
        <svg class="chevron" :class="{ open: isRootOpen }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        <svg class="folder-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-peach)" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
        <span class="folder-name">{{ rootName }}</span>
      </div>
      
      <div class="tree-children" v-if="isRootOpen">
        <div 
          v-for="file in files" 
          :key="file.path"
          class="tree-item file"
          :class="{ active: file.path === currentFilePath }"
          @click="selectFile(file)"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          <span class="file-name">{{ file.name }}</span>
        </div>
        
        <div v-if="files.length === 0" class="tree-empty">
          暂无 Markdown 文件
        </div>
      </div>
    </div>
    
    <div class="tree-empty tree-prompt" v-else>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
      <p>点击 + 打开文件夹</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const isTauri = '__TAURI_INTERNALS__' in window

// 静态导入 Tauri API，避免动态导入的竞态问题
import { invoke } from '@tauri-apps/api/core'
import { open as openDialog } from '@tauri-apps/plugin-dialog'

interface FileItem { name: string; path: string }
const emit = defineEmits<{ (e: 'select', path: string): void; (e: 'close'): void }>()

const rootPath = ref('')
const rootName = ref('')
const isRootOpen = ref(true)
const files = ref<FileItem[]>([])
const currentFilePath = ref('')

const openFolder = async () => {
  if (!isTauri) {
    rootPath.value = '/demo/workspace'
    rootName.value = 'demo-workspace'
    files.value = [
      { name: 'README.md', path: '/demo/workspace/README.md' },
      { name: '笔记.md', path: '/demo/workspace/笔记.md' },
      { name: '项目文档.md', path: '/demo/workspace/项目文档.md' }
    ]
    isRootOpen.value = true
    return
  }
  try {
    const selected = await openDialog({ directory: true, multiple: false, title: '选择工作区文件夹' })
    if (selected) {
      rootPath.value = selected as string
      rootName.value = (selected as string).split('/').pop() || '文件夹'
      await loadFiles(selected as string)
    }
  } catch (error) { console.error('打开文件夹失败:', error) }
}

const loadFiles = async (dirPath: string) => {
  if (!isTauri) return
  try {
    const entries = await invoke('read_dir', { path: dirPath }) as any[]
    files.value = entries
      .filter((e: any) => e.name.endsWith('.md') || e.name.endsWith('.markdown'))
      .map((e: any) => ({ name: e.name, path: e.path }))
    isRootOpen.value = true
  } catch (error) {
    console.error('加载文件失败:', error)
    files.value = []
  }
}

const toggleFolder = (folder: string) => { if (folder === 'root') isRootOpen.value = !isRootOpen.value }
const selectFile = (file: FileItem) => { currentFilePath.value = file.path; emit('select', file.path) }

const readFile = async (filePath: string): Promise<string> => {
  if (!isTauri) return ''
  try { return await invoke('read_file', { path: filePath }) as string } catch { return '' }
}
const saveFile = async (filePath: string, content: string): Promise<boolean> => {
  if (!isTauri) return false
  try {
    await invoke('write_file', { path: filePath, content })
    console.log('✅ 文件保存成功:', filePath)
    return true
  } catch (error) {
    console.error('❌ 保存文件失败:', filePath, error)
    alert(`保存文件失败:\n${filePath}\n\n错误: ${error}`)
    return false
  }
}

defineExpose({ readFile, saveFile })
</script>

<style scoped>
.file-tree {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

/* 增强头部 */
.tree-header {
  padding: 14px 16px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-subtle);
  background: linear-gradient(180deg, var(--bg-surface0), transparent);
}
.tree-title {
  font-size: 11px;
  font-weight: 800;
  color: var(--text-muted);
  letter-spacing: 1.5px;
  text-transform: uppercase;
}
.tree-action {
  background: none;
  border: 1px solid transparent;
  color: var(--text-muted);
  cursor: pointer;
  padding: 6px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}
.tree-action:hover {
  color: var(--accent);
  background: var(--accent-soft);
  border-color: var(--accent);
  transform: scale(1.05);
}
.tree-action:active {
  transform: scale(0.95);
}

/* 文件列表区域 */
.tree-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px 10px;
}

/* 树项 - 增强交互 */
.tree-item {
  padding: 7px 10px;
  cursor: pointer;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  gap: 7px;
  transition: all var(--transition-fast);
  user-select: none;
  font-size: 13px;
  color: var(--text-secondary);
  position: relative;
  margin-bottom: 2px;
}
.tree-item::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 0;
  background: linear-gradient(180deg, var(--accent), var(--accent-mauve));
  border-radius: 0 3px 3px 0;
  transition: all var(--transition-fast);
  opacity: 0;
}
.tree-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
  transform: translateX(2px);
}
.tree-item:hover::before {
  height: 60%;
  opacity: 1;
}
.tree-item.active {
  background: linear-gradient(135deg, var(--accent-soft), transparent);
  color: var(--accent);
  box-shadow:
    inset 0 0 0 1px var(--border-color),
    0 2px 8px var(--shadow-glow);
}
.tree-item.active::before {
  height: 70%;
  opacity: 1;
}

/* 箭头图标 */
.chevron {
  flex-shrink: 0;
  transition: transform var(--transition-smooth);
  color: var(--text-muted);
  opacity: 0.6;
}
.chevron:hover {
  opacity: 1;
  transform: scale(1.15) !important;
}
.chevron.open { 
  transform: rotate(90deg); 
  color: var(--accent);
  opacity: 1;
}

.folder-svg { 
  flex-shrink: 0; 
  filter: drop-shadow(0 1px 2px rgba(250, 179, 135, 0.2));
}

/* 文件夹名称 */
.folder-name {
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  letter-spacing: -0.01em;
}

/* 文件名样式 */
.file-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 450;
}

/* 子项缩进 */
.tree-children {
  padding-left: 14px;
  position: relative;
}
.tree-children::before {
  content: '';
  position: absolute;
  left: 18px;
  top: 4px;
  bottom: 4px;
  width: 1px;
  background: linear-gradient(180deg, var(--border-subtle), transparent);
  opacity: 0.5;
}

/* 空状态 */
.tree-empty {
  padding: 24px 20px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}
.tree-prompt {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 80px;
  animation: fadeInUp 0.5s ease-out;
}
.tree-prompt svg {
  opacity: 0.35;
  filter: drop-shadow(0 4px 12px var(--accent-soft));
}
.tree-prompt p {
  color: var(--text-muted);
  font-weight: 500;
  font-size: 13px;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
