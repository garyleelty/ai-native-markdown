<template>
  <div class="app-container">
    <!-- 标题栏 -->
    <header class="app-header">
      <div class="header-left">
        <button class="toolbar-btn" @click="toggleSidebar" :class="{ active: settingsStore.showSidebar }" title="侧边栏">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
        </button>
        <div class="app-brand">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          <span class="brand-text">AI Markdown</span>
        </div>
      </div>
      <div class="header-center">
        <span v-if="editorStore.currentFile" class="current-file">{{ editorStore.currentFile.split('/').pop() }}</span>
      </div>
      <div class="header-right">
        <button class="toolbar-btn" @click="toggleAIPanel" :class="{ active: settingsStore.showAIPanel }" title="AI 助手">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a4 4 0 014 4v1a1 1 0 001 1h1a4 4 0 010 8h-1a1 1 0 00-1 1v1a4 4 0 01-8 0v-1a1 1 0 00-1-1H6a4 4 0 010-8h1a1 1 0 001-1V6a4 4 0 014-4z"/></svg>
        </button>
        <button class="toolbar-btn" @click="cycleViewMode" :class="{ active: editorStore.viewMode !== 'source' }" title="切换视图">
          <svg v-if="editorStore.viewMode === 'split'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/></svg>
          <svg v-else-if="editorStore.viewMode === 'preview'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
        </button>
        
        <!-- 导出菜单 -->
        <div class="toolbar-btn export-btn" @click="toggleExportMenu" :class="{ active: showExportMenu }" title="导出文档">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </div>
        
        <button class="toolbar-btn" @click="toggleTheme" title="切换主题">
          <svg v-if="isDark" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
          <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
        </button>
      </div>
    </header>

    <!-- 主内容区域 -->
    <div class="main-content">
      <!-- 侧边栏 -->
      <aside 
        class="sidebar-panel" 
        :class="{ collapsed: !settingsStore.showSidebar }"
        :style="{ width: settingsStore.showSidebar ? settingsStore.sidebarWidth + 'px' : '0' }"
      >
        <Sidebar 
          v-if="settingsStore.showSidebar" 
          ref="sidebarRef"
          :is-dark="isDark"
          :show-a-i="settingsStore.showAIPanel"
          @select="handleFileSelect"
          @toggle-theme="toggleTheme"
          @toggle-ai="toggleAIPanel"
        />
        <div class="resize-handle resize-handle-right" @mousedown="startResize('sidebar', $event)" v-if="settingsStore.showSidebar"></div>
      </aside>

      <!-- 编辑器 + 预览 + AI 面板容器 -->
      <main class="editor-container-main">
        <div class="editor-area" :class="{ 'with-ai': settingsStore.showAIPanel }">
          <!-- Tab 栏 -->
          <div v-if="editorStore.openTabs.length > 0" class="tabs-bar">
            <div 
              v-for="tab in editorStore.openTabs" 
              :key="tab.id"
              class="tab-item"
              :class="{ active: tab.id === editorStore.activeTabId, modified: tab.isModified }"
              @click="editorStore.switchTab(tab.id)"
            >
              <span class="tab-name">{{ tab.fileName }}</span>
              <button class="tab-close" @click.stop="handleCloseTab(tab.id)">×</button>
            </div>
          </div>

          <!-- Obsidian 风格分栏：编辑器 + 预览在一起 -->
          <div class="split-view">
            <div class="split-editor" v-if="editorStore.viewMode !== 'preview'" :style="editorStore.viewMode === 'split' ? { width: settingsStore.splitRatio + '%' } : { width: '100%' }">
              <Editor 
                ref="editorRef"
                v-model="editorContent"
                @update="handleEditorUpdate"
                @cursor-change="handleCursorChange"
              />
            </div>
            <div class="split-divider" v-if="editorStore.viewMode === 'split'" @mousedown="startResize('split', $event)">
              <div class="split-divider-line"></div>
            </div>
            <div class="split-preview" v-if="editorStore.viewMode !== 'source'">
              <Preview 
                :content="editorContent"
                :cursor-line="editorStore.cursorLine"
              />
            </div>
          </div>
        </div>
        
        <!-- 内嵌式 AI 面板 -->
        <Transition name="ai-slide-up">
          <aside class="ai-panel-section" v-if="settingsStore.showAIPanel">
            <ChatPanel 
              :context="selectedText || editorContent.slice(0, 2000)"
              @insert="handleAIInsert"
            />
            <div class="resize-handle resize-handle-top" @mousedown="startResize('aiPanel', $event)"></div>
          </aside>
        </Transition>
      </main>
    </div>

    <!-- 导出菜单下拉 -->
    <Transition name="dropdown">
      <div v-if="showExportMenu" class="export-menu" @click="showExportMenu = false">
        <div class="export-menu-content" @click.stop>
          <div class="export-menu-title">导出文档</div>
          <button class="export-option" @click="exportAsMarkdown">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
            <span>导出为 Markdown</span>
          </button>
          <button class="export-option" @click="exportAsHTML">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8.5L13.5 2z"/><polyline points="13.5 2 13.5 8 19 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            <span>导出为 HTML</span>
          </button>
        </div>
      </div>
    </Transition>

    <!-- 底部状态栏 -->
    <footer class="status-bar">
      <span class="status-item">Markdown</span>
      <span class="status-item" v-if="editorStore.cursorLine > 0">行 {{ editorStore.cursorLine }}</span>
      <span class="status-spacer"></span>
      <span class="status-item" :class="saveStatusClass" v-if="saveStatusMessage">
        {{ saveStatusMessage }}
      </span>
      <span class="status-item" v-if="editorStore.isModified">● 未保存</span>
      <span class="status-item" v-else>✓ 已保存</span>
      <span class="status-item view-mode-indicator" @click="cycleViewMode" title="点击切换视图">
        {{ editorStore.viewMode === 'split' ? '分栏' : editorStore.viewMode === 'source' ? '源码' : '预览' }}
      </span>
      <span class="status-item">{{ editorContent.length }} 字符</span>
      <span class="status-item ai-status" v-if="settingsStore.showAIPanel">AI 已启用</span>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useSettingsStore } from './stores/settings'
import { useEditorStore } from './stores/editor'
import Sidebar from './components/Sidebar.vue'
import Editor from './components/Editor.vue'
import Preview from './components/Preview.vue'
import ChatPanel from './components/ai-panel/ChatPanel.vue'

const settingsStore = useSettingsStore()
const editorStore = useEditorStore()

const editorRef = ref()
const sidebarRef = ref()
const selectedText = ref('')
const showExportMenu = ref(false)
const saveStatusMessage = ref('')
const saveStatusClass = ref('')

const editorContent = computed({
  get: () => editorStore.content,
  set: (value: string) => editorStore.setContent(value)
})

const isDark = computed(() => {
  const { theme } = settingsStore
  if (theme === 'dark') return true
  if (theme === 'light') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
})

const toggleSidebar = () => { settingsStore.toggleSidebar() }
const toggleAIPanel = () => { settingsStore.toggleAIPanel() }

const cycleViewMode = () => {
  const modes: ('split' | 'source' | 'preview')[] = ['split', 'source', 'preview']
  const idx = modes.indexOf(editorStore.viewMode)
  editorStore.setViewMode(modes[(idx + 1) % modes.length])
}

const toggleTheme = () => {
  const themes: ('dark' | 'light' | 'system')[] = ['dark', 'light', 'system']
  const currentIndex = themes.indexOf(settingsStore.theme)
  const nextTheme = themes[(currentIndex + 1) % themes.length]
  settingsStore.setTheme(nextTheme)
  
  document.documentElement.classList.toggle('light', nextTheme === 'light' || 
    (nextTheme === 'system' && !window.matchMedia('(prefers-color-scheme: dark)').matches))
}

const toggleExportMenu = () => {
  showExportMenu.value = !showExportMenu.value
}

const exportAsMarkdown = async () => {
  const content = editorStore.content
  const fileName = editorStore.currentFile ? editorStore.currentFile.split('/').pop() || 'document.md' : 'document.md'
  const blob = new Blob([content], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  showExportMenu.value = false
}

const exportAsHTML = async () => {
  const content = editorStore.content
  const fileName = editorStore.currentFile ? editorStore.currentFile.split('/').pop()?.replace(/\.md$/i, '.html') || 'document.html' : 'document.html'
  
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    const htmlContent = await invoke('export_html', { content, title: fileName.replace('.html', '') }) as string
    const blob = new Blob([htmlContent], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('导出 HTML 失败:', error)
    alert('导出失败，请确保应用已正确构建')
  }
  showExportMenu.value = false
}

const handleFileSelect = async (filePath: string) => {
  if (editorStore.isModified && editorStore.currentFile) {
    await saveCurrentFile()
  }
  
  if (sidebarRef.value) {
    const content = await sidebarRef.value.readFile(filePath)
    editorStore.addTab(filePath, content)
    if (editorRef.value) editorRef.value.setContent(content)
  }
}

const handleCloseTab = async (tabId: string) => {
  const tab = editorStore.openTabs.find(t => t.id === tabId)
  if (tab?.isModified) {
    if (!confirm(`文件 "${tab.fileName}" 有未保存的更改，确定要关闭吗？`)) {
      return
    }
  }
  editorStore.closeTab(tabId)
  const activeTab = editorStore.getActiveTab()
  if (activeTab && editorRef.value) {
    editorRef.value.setContent(activeTab.content)
  }
}

const saveCurrentFile = async () => {
  if (!editorStore.currentFile || !sidebarRef.value) {
    return
  }
  
  saveStatusMessage.value = '正在保存...'
  saveStatusClass.value = 'status-saving'
  
  const success = await sidebarRef.value.saveFile(editorStore.currentFile, editorStore.content)
  
  if (success) {
    editorStore.markSaved()
    saveStatusMessage.value = '✓ 保存成功'
    saveStatusClass.value = 'status-saved'
    
    // 3秒后清除成功提示
    setTimeout(() => {
      saveStatusMessage.value = ''
      saveStatusClass.value = ''
    }, 3000)
  } else {
    saveStatusMessage.value = '✗ 保存失败'
    saveStatusClass.value = 'status-error'
  }
}

let saveTimer: number | null = null
watch(() => editorStore.content, () => {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(async () => { await saveCurrentFile() }, 2000)
})

const handleEditorUpdate = (content: string) => { editorStore.setContent(content) }
const handleCursorChange = (line: number) => { editorStore.setCursor(line, 0) }
const handleAIInsert = (text: string) => {
  if (editorRef.value) editorRef.value.insertText(text)
}

let resizing = ''
let startPos = { x: 0, y: 0 }
let startSize = { w: 0, h: 0, ratio: 0 }
const startResize = (panel: string, event: MouseEvent) => {
  resizing = panel
  startPos.x = event.clientX
  startPos.y = event.clientY
  if (panel === 'sidebar') startSize.w = settingsStore.sidebarWidth
  else if (panel === 'split') startSize.ratio = settingsStore.splitRatio
  else if (panel === 'aiPanel') startSize.h = settingsStore.aiPanelHeight
  
  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
  
  if (panel === 'aiPanel') {
    document.body.style.cursor = 'row-resize'
  } else {
    document.body.style.cursor = 'col-resize'
  }
  document.body.style.userSelect = 'none'
}
const handleResize = (event: MouseEvent) => {
  if (!resizing) return
  
  if (resizing === 'sidebar') {
    const diff = event.clientX - startPos.x
    settingsStore.setSidebarWidth(Math.max(200, Math.min(420, startSize.w + diff)))
  } else if (resizing === 'split') {
    const editorArea = document.querySelector('.split-view') as HTMLElement
    if (editorArea) {
      const rect = editorArea.getBoundingClientRect()
      const ratio = ((event.clientX - rect.left) / rect.width) * 100
      settingsStore.setSplitRatio(Math.max(25, Math.min(75, ratio)))
    }
  } else if (resizing === 'aiPanel') {
    const diff = window.innerHeight - event.clientY - 70
    settingsStore.setAIPanelHeight(Math.max(140, Math.min(400, diff)))
  }
}
const stopResize = () => {
  resizing = ''
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

onMounted(() => {
  setInterval(() => {
    if (editorRef.value) selectedText.value = editorRef.value.getSelectedText()
  }, 500)
  
  editorStore.setContent('')
  
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  if (settingsStore.theme === 'system') {
    document.documentElement.classList.toggle('light', !systemTheme)
  } else {
    document.documentElement.classList.toggle('light', settingsStore.theme === 'light')
  }
})

onUnmounted(() => { stopResize() })
</script>

<style scoped>
.app-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-base);
}

.app-header {
  height: 44px;
  background: var(--bg-mantle);
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-4);
  flex-shrink: 0;
  -webkit-app-region: drag;
  position: relative;
  z-index: 50;
}
.header-left, .header-right {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  -webkit-app-region: no-drag;
}
.header-center {
  flex: 1;
  text-align: center;
  max-width: 300px;
  margin: 0 auto;
}

.app-brand {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--accent);
  margin-left: var(--space-2);
}
.brand-text {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.3px;
  color: var(--text-primary);
}

.current-file {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  background: var(--bg-surface);
  padding: 3px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-subtle);
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: all var(--transition-fast);
}
.current-file:hover {
  color: var(--text-primary);
  border-color: var(--accent);
}

.toolbar-btn {
  width: 28px;
  height: 28px;
  background: none;
  border: 1px solid transparent;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: var(--radius-xs);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}
.toolbar-btn:hover {
  color: var(--text-secondary);
  background: var(--bg-hover);
}
.toolbar-btn.active {
  color: var(--accent);
  background: var(--accent-soft);
  border-color: var(--accent);
}

.main-content {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
  background: var(--bg-base);
}

.sidebar-panel {
  background: var(--bg-mantle);
  overflow: hidden;
  flex-shrink: 0;
  position: relative;
  transition: width var(--transition-smooth), opacity 0.2s;
  border-right: 1px solid var(--border-subtle);
}
.sidebar-panel.collapsed {
  width: 0 !important;
  border-right: none;
  opacity: 0;
}

.editor-container-main {
  flex: 1;
  overflow: hidden;
  min-width: 360px;
  display: flex;
  flex-direction: column;
  background: var(--bg-base);
  position: relative;
}
.editor-area {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: all var(--transition-smooth);
}

.tabs-bar {
  display: flex;
  align-items: center;
  background: var(--bg-mantle);
  border-bottom: 1px solid var(--border-subtle);
  padding: 0 var(--space-3);
  gap: var(--space-1);
  flex-shrink: 0;
  overflow-x: auto;
}
.tab-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 5px 10px;
  border-radius: var(--radius-xs) var(--radius-xs) 0 0;
  background: transparent;
  cursor: pointer;
  transition: all var(--transition-fast);
  min-width: 80px;
  max-width: 180px;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}
.tab-item:hover {
  background: var(--bg-hover);
}
.tab-item.active {
  background: var(--bg-base);
  color: var(--text-primary);
  border-bottom-color: var(--accent);
}
.tab-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tab-item.active .tab-name {
  color: var(--text-primary);
}
.tab-item.modified .tab-name::after {
  content: '';
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  margin-left: var(--space-2);
  vertical-align: middle;
}
.tab-close {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px;
  border-radius: 3px;
  font-size: 14px;
  line-height: 1;
  opacity: 0;
  transition: all var(--transition-fast);
}
.tab-item:hover .tab-close {
  opacity: 1;
}
.tab-close:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.ai-panel-section {
  height: v-bind(settingsStore.aiPanelHeight + 'px');
  min-height: 120px;
  max-height: 450px;
  border-top: 1px solid var(--border-subtle);
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--bg-base);
  z-index: 10;
}
.ai-panel-section :deep(.ai-panel-embedded) {
  height: 100%;
  border-top: none;
}

.resize-handle-top {
  position: absolute;
  top: -3px;
  left: 20%;
  right: 20%;
  height: 6px;
  cursor: row-resize;
  z-index: 25;
}
.resize-handle-top::before {
  content: '';
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  width: 32px;
  height: 3px;
  background: var(--border-subtle);
  border-radius: 2px;
  opacity: 0;
  transition: all var(--transition-fast);
}
.resize-handle-top:hover::before {
  opacity: 1;
  background: var(--accent);
}

.ai-slide-up-enter-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
}
.ai-slide-up-leave-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
}
.ai-slide-up-enter-from,
.ai-slide-up-leave-to {
  opacity: 0 !important;
  max-height: 0 !important;
  transform: translateY(8px);
}

.ai-status {
  color: var(--accent) !important;
  font-weight: 500 !important;
  opacity: 1 !important;
}
.ai-status::before {
  content: '';
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  margin-right: var(--space-2);
  vertical-align: middle;
  animation: pulse-dot 2s ease-in-out infinite;
}

.split-view {
  display: flex;
  height: 100%;
  overflow: hidden;
}
.split-editor {
  flex-shrink: 0;
  overflow: hidden;
  height: 100%;
  transition: width 0.15s ease;
}
.split-preview {
  flex: 1;
  overflow: hidden;
  height: 100%;
  min-width: 0;
}
.split-divider {
  width: 6px;
  cursor: col-resize;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 15;
  background: var(--bg-base);
  transition: background var(--transition-fast);
}
.split-divider:hover {
  background: var(--accent-soft);
}
.split-divider-line {
  width: 1px;
  height: 40px;
  background: var(--border-subtle);
  border-radius: 1px;
  transition: all var(--transition-fast);
}
.split-divider:hover .split-divider-line {
  height: 60px;
  background: var(--accent);
  width: 2px;
}

.view-mode-indicator {
  cursor: pointer;
  padding: 1px 8px;
  border-radius: var(--radius-xs);
  transition: all var(--transition-fast);
}
.view-mode-indicator:hover {
  background: var(--accent-soft);
  color: var(--accent);
}

.resize-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 6px;
  cursor: col-resize;
  z-index: 20;
  transition: all var(--transition-fast);
}
.resize-handle::before {
  content: '';
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 2px;
  height: 32px;
  background: var(--border-subtle);
  border-radius: 2px;
  opacity: 0;
  transition: all var(--transition-fast);
}
.resize-handle:hover::before {
  opacity: 1;
  background: var(--accent);
}
.resize-handle-right { right: -3px; }
.resize-handle-left { left: -3px; }

.status-bar {
  height: 26px;
  background: var(--bg-mantle);
  border-top: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
  padding: 0 var(--space-4);
  font-size: 11px;
  color: var(--text-muted);
  gap: var(--space-4);
  flex-shrink: 0;
  position: relative;
  z-index: 40;
}
.status-item {
  opacity: 0.75;
  font-weight: 500;
  transition: all var(--transition-fast);
  cursor: default;
}
.status-item:hover {
  color: var(--text-secondary);
  opacity: 1;
}
.status-item.status-saving {
  color: var(--accent-blue);
  opacity: 1;
  animation: pulse 1s ease-in-out infinite;
}
.status-item.status-saved {
  color: var(--accent-green);
  opacity: 1;
}
.status-item.status-error {
  color: var(--accent-red);
  opacity: 1;
  animation: shake 0.3s ease-in-out;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-3px); }
  75% { transform: translateX(3px); }
}
.status-spacer {
  flex: 1;
}

/* 导出菜单 */
.export-menu {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 50px;
}
.export-menu-content {
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  padding: var(--space-2);
  min-width: 180px;
  animation: dropdownIn 0.15s ease-out;
}
.export-menu-title {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
  padding: 5px 10px;
  border-bottom: 1px solid var(--border-subtle);
  margin-bottom: var(--space-1);
}
.export-option {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  padding: 7px 10px;
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  text-align: left;
}
.export-option:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.export-option svg {
  color: var(--text-muted);
  flex-shrink: 0;
}
.export-option:hover svg {
  color: var(--accent);
}
.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.15s ease;
}
.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
}
@keyframes dropdownIn {
  from { opacity: 0; transform: translateY(-4px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
</style>