<template>
  <el-container class="app-container" :class="{ 'focus-mode-active': focusMode }" @dragenter="handleDragEnter" @dragleave="handleDragLeave" @dragover="handleDragOver" @drop="handleDrop">
    <CommandPalette v-model="showCommandPalette" @execute="handleCommandExecute" />
    <TemplateGallery v-model="showTemplateGallery" @select="handleTemplateSelect" />
    <VersionHistoryPanel v-model="showVersionHistory" :file-path="editorStore.currentFile" @restore="handleVersionRestore" />
    <ExportDialog v-model="showExportDialog" :content="editorContent" :default-file-name="currentFileName" />
    <MarkdownCheatsheet v-model="showCheatsheet" />
    <FocusMode :active="focusMode" :file-name="currentFileName" :word-count="wordCount" @exit="focusMode = false" />
    <el-header class="app-header" height="48px">
      <div class="header-left">
        <el-tooltip content="切换侧边栏" placement="bottom">
          <el-button :icon="Operation" circle size="small" aria-label="切换侧边栏" @click="toggleSidebar" />
        </el-tooltip>
        <div class="app-brand">
          <el-icon :size="20" color="var(--el-color-primary)"><Document /></el-icon>
          <span class="brand-text">AI Markdown</span>
        </div>
      </div>
      <div class="header-center">
        <el-tag v-if="editorStore.currentFile" effect="plain" round>
          {{ editorStore.currentFile.split('/').pop() }}
        </el-tag>
      </div>
      <div class="header-right">
        <el-tooltip content="AI 助手" placement="bottom">
          <el-button :icon="ChatDotRound" circle size="small" aria-label="AI 助手" :type="settingsStore.showAIPanel ? 'primary' : 'default'" @click="toggleAIPanel" />
        </el-tooltip>
        <el-tooltip :content="viewModeTooltip" placement="bottom">
          <el-button :icon="editorStore.viewMode === 'preview' ? EditPen : View" circle size="small" aria-label="切换视图模式" @click="cycleViewMode" />
        </el-tooltip>
        <el-tooltip content="版本历史" placement="bottom" v-if="editorStore.currentFile">
          <el-button :icon="Clock" circle size="small" aria-label="版本历史" @click="showVersionHistory = true" />
        </el-tooltip>
        <el-dropdown trigger="click" @command="handleExport">
          <el-button :icon="Download" circle size="small" aria-label="导出" />
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="export">导出...</el-dropdown-item>
              <el-dropdown-item command="cheatsheet">Markdown 语法</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-tooltip content="专注模式 (F11)" placement="bottom">
          <el-button :icon="FullScreen" circle size="small" aria-label="专注模式" :type="focusMode ? 'primary' : 'default'" @click="focusMode = !focusMode" />
        </el-tooltip>
        <el-tooltip content="切换主题" placement="bottom">
          <el-button :icon="isDark ? Moon : Sunny" circle size="small" aria-label="切换主题" @click="toggleTheme" />
        </el-tooltip>
      </div>
    </el-header>

    <el-container class="main-container">
      <el-aside :width="settingsStore.showSidebar ? settingsStore.sidebarWidth + 'px' : '0px'" class="sidebar-aside">
        <Sidebar
          v-if="settingsStore.showSidebar"
          ref="sidebarRef"
          :is-dark="isDark"
          :show-a-i="settingsStore.showAIPanel"
          :current-file="editorStore.currentFile"
          :editor-content="editorContent"
          :cursor-line="editorStore.cursorLine"
          @select="handleFileSelect"
          @set-theme="setThemeFromSwitch"
          @toggle-ai="toggleAIPanel"
          @navigate="handleOutlineNavigate"
          @renamed="handleFileTreeRename"
          @deleted="handleFileTreeDelete"
        />
        <div v-if="settingsStore.showSidebar" class="resize-handle-v" @mousedown="startResize('sidebar', $event)" />
      </el-aside>

      <el-container class="editor-container-main" direction="Vertical">
        <el-main class="editor-main">
          <div v-if="editorStore.openTabs.length > 0" class="tabs-bar">
            <el-tabs
              v-model="activeTabModel"
              type="card"
              closable
              @tab-remove="handleCloseTab"
              @tab-change="handleTabChange"
            >
              <el-tab-pane
                v-for="tab in editorStore.openTabs"
                :key="tab.id"
                :label="tab.fileName"
                :name="tab.id"
              >
                <template #label>
                  <span class="tab-label" :class="{ modified: tab.isModified }">
                    {{ tab.fileName }}
                  </span>
                </template>
              </el-tab-pane>
            </el-tabs>
          </div>

          <WelcomePage
            v-if="editorStore.openTabs.length === 0"
            @new-file="handleNewFileFromWelcome"
            @open-folder="handleOpenFolderFromWelcome"
            @demo="handleDemoFromWelcome"
          />
          <div v-else class="editor-preview-view" :class="{ 'split-mode': editorStore.viewMode === 'split' }">
            <Editor
              v-if="editorStore.viewMode !== 'preview'"
              ref="editorRef"
              v-model="editorContent"
              @update="handleEditorUpdate"
              @cursor-change="handleCursorChange"
              @selection-change="handleSelectionChange"
              class="editor-pane"
            />
            <Preview
              v-if="editorStore.viewMode !== 'source'"
              :content="editorContent"
              :cursor-line="editorStore.cursorLine"
              class="preview-pane"
              @heading-click="handleOutlineNavigate"
            />
          </div>
        </el-main>

        <Transition name="ai-slide">
          <div v-if="settingsStore.showAIPanel" class="ai-panel-section" :style="{ height: settingsStore.aiPanelHeight + 'px' }">
            <div class="resize-handle-h" @mousedown="startResize('aiPanel', $event)" />
            <ChatPanel
              :context="selectedText || editorContent.slice(0, 2000)"
              @insert="handleAIInsert"
            />
          </div>
        </Transition>
      </el-container>
    </el-container>

    <el-footer class="status-bar" height="28px">
      <span class="status-item">
        <el-tag size="small" type="info" effect="plain" disable-transitions>Markdown</el-tag>
      </span>
      <span class="status-item" v-if="editorStore.cursorLine > 0">行 {{ editorStore.cursorLine }}</span>
      <span class="status-spacer" />
      <span class="status-item" :class="saveStatusClass">
        <span v-if="saveStatusMessage" class="save-status">{{ saveStatusMessage }}</span>
        <template v-else-if="editorStore.isModified">
          <span class="status-dot saving" />
          未保存
        </template>
        <template v-else>
          已保存
        </template>
      </span>
      <span class="status-item view-mode-btn" @click="cycleViewMode">
        {{ viewModeLabel }}
      </span>
      <DocumentStats :content="editorContent">
        <span class="status-item status-clickable">{{ wordCount }} 词 · {{ editorContent.length }} 字符</span>
      </DocumentStats>
      <span class="status-item" v-if="sessionDuration">{{ sessionDuration }}</span>
      <span class="status-item ai-status" v-if="settingsStore.showAIPanel">
        <span class="status-dot primary" />
        AI 已启用
      </span>
      <WritingGoal :current="wordCount" />
    </el-footer>
    <Transition name="fade">
      <div v-if="isDragging" class="drag-overlay">
        <div class="drag-content">
          <el-icon :size="48" color="var(--el-color-primary)"><Upload /></el-icon>
          <p>拖放 Markdown 文件到此处</p>
        </div>
      </div>
    </Transition>
  </el-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, defineAsyncComponent } from 'vue'
import { ElMessage } from 'element-plus'
import { Operation, Document, ChatDotRound, View, EditPen, Download, Moon, Sunny, Clock, Upload, FullScreen } from '@element-plus/icons-vue'
import { useSettingsStore } from './stores/settings'
import { useEditorStore } from './stores/editor'
import { fileSystem } from './services/fileSystem'
import { useFileOperations } from './composables/useFileOperations'
import { useExport } from './composables/useExport'
import './styles/app.css'
import Sidebar from './components/Sidebar.vue'
import Editor from './components/Editor.vue'
import Preview from './components/Preview.vue'
import ChatPanel from './components/ai-panel/ChatPanel.vue'
import CommandPalette from './components/CommandPalette.vue'
import WelcomePage from './components/WelcomePage.vue'
import DocumentStats from './components/editor/DocumentStats.vue'
import FocusMode from './components/editor/FocusMode.vue'
import WritingGoal from './components/editor/WritingGoal.vue'
import { getActiveSession, updateSession, getSessionDuration } from './utils/writingSession'

const TemplateGallery = defineAsyncComponent(() => import('./components/TemplateGallery.vue'))
const VersionHistoryPanel = defineAsyncComponent(() => import('./components/editor/VersionHistoryPanel.vue'))
const ExportDialog = defineAsyncComponent(() => import('./components/ExportDialog.vue'))
const MarkdownCheatsheet = defineAsyncComponent(() => import('./components/MarkdownCheatsheet.vue'))
const settingsStore = useSettingsStore()
const editorStore = useEditorStore()

const editorRef = ref()
const sidebarRef = ref()
const selectedText = ref('')
const showCommandPalette = ref(false)
const showTemplateGallery = ref(false)
const showVersionHistory = ref(false)
const isDragging = ref(false)
const dragCounter = ref(0)
const focusMode = ref(false)
const showExportDialog = ref(false)
const showCheatsheet = ref(false)
const sessionDuration = ref('')

const {
  saveStatusMessage,
  saveStatusClass,
  saveCurrentFile,
  handleFileSelect,
  handleCloseTab,
  handleTabChange,
  handleTemplateSelect,
  handleBeforeUnload,
  handleSaveKeyDown,
} = useFileOperations(editorRef)

const {
  exportAsMarkdown,
  exportAsHTML,
} = useExport()

const handleExport = (command: string) => {
  if (command === 'export') showExportDialog.value = true
  else if (command === 'cheatsheet') showCheatsheet.value = true
}

const editorContent = computed({
  get: () => editorStore.content,
  set: (value: string) => editorStore.setContent(value)
})

const isDark = computed(() => settingsStore.isDark())

const currentFileName = computed(() => editorStore.currentFile?.split('/').pop()?.replace(/\.md$/i, '') || 'document')

const activeTabModel = computed({
  get: () => editorStore.activeTabId || '',
  set: (id: string) => { if (id) editorStore.switchTab(id) }
})

const toggleSidebar = () => settingsStore.toggleSidebar()
const toggleAIPanel = () => settingsStore.toggleAIPanel()

const cycleViewMode = () => {
  const modes: ('source' | 'preview' | 'split')[] = ['source', 'split', 'preview']
  const idx = modes.indexOf(editorStore.viewMode)
  editorStore.setViewMode(modes[(idx + 1) % modes.length])
}

const viewModeTooltip = computed(() => {
  const map: Record<string, string> = { source: '分屏模式', split: '预览模式', preview: '源码模式' }
  return map[editorStore.viewMode] || '切换视图'
})

const viewModeLabel = computed(() => {
  const map: Record<string, string> = { source: '源码', split: '分屏', preview: '预览' }
  return map[editorStore.viewMode] || '源码'
})

const toggleTheme = () => settingsStore.toggleTheme()
const setThemeFromSwitch = (dark: boolean) => settingsStore.setTheme(dark ? 'dark' : 'light')

const wordCount = computed(() => {
  const text = editorContent.value.trim()
  if (!text) return 0
  const cjk = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length
  const words = text.replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, ' ').split(/\s+/).filter(w => w.length > 0).length
  return cjk + words
})

const handleEditorUpdate = (content: string) => editorStore.setContent(content)
const handleCursorChange = (line: number) => editorStore.setCursor(line, 0)
const handleSelectionChange = (text: string) => { selectedText.value = text }
const handleOutlineNavigate = (lineNumber: number) => {
  if (editorRef.value) editorRef.value.scrollToLine?.(lineNumber)
}
const handleAIInsert = (text: string) => {
  if (editorRef.value) editorRef.value.insertText(text)
}

const syncEditorFromActiveTab = () => {
  const activeTab = editorStore.getActiveTab()
  const nextContent = activeTab?.content || ''
  if (editorRef.value) {
    editorRef.value.setContent(nextContent)
  }
}

const handleFileTreeRename = (payload: { oldPath: string; newPath: string; isDirectory: boolean }) => {
  editorStore.renameOpenPath(payload.oldPath, payload.newPath, payload.isDirectory)
  syncEditorFromActiveTab()
}

const handleFileTreeDelete = (payload: { path: string; isDirectory: boolean }) => {
  editorStore.removeOpenPath(payload.path, payload.isDirectory)
  syncEditorFromActiveTab()
}

const handleVersionRestore = (content: string) => {
  editorStore.setContent(content)
  if (editorRef.value) editorRef.value.setContent(content)
  showVersionHistory.value = false
}

const handleDragEnter = (e: DragEvent) => {
  e.preventDefault()
  dragCounter.value++
  isDragging.value = true
}

const handleDragLeave = (e: DragEvent) => {
  e.preventDefault()
  dragCounter.value--
  if (dragCounter.value === 0) isDragging.value = false
}

const handleDragOver = (e: DragEvent) => {
  e.preventDefault()
}

const handleDrop = async (e: DragEvent) => {
  e.preventDefault()
  isDragging.value = false
  dragCounter.value = 0
  const files = e.dataTransfer?.files
  if (!files || files.length === 0) return

  for (const file of Array.from(files)) {
    if (file.name.endsWith('.md') || file.name.endsWith('.markdown')) {
      try {
        const content = await file.text()
        const path = `/workspace/${file.name}`
        await fileSystem.writeFile(path, content)
        editorStore.addTab(path, content)
        if (editorRef.value) {
          editorStore.setContentSilent(content)
          editorRef.value.setContent(content)
        }
      } catch (e: any) {
        ElMessage.error(`导入 ${file.name} 失败`)
      }
    }
  }
  ElMessage.success(`已导入 ${files.length} 个文件`)
}

const handleNewFileFromWelcome = () => {
  sidebarRef.value?.handleCreateFile?.()
}

const handleOpenFolderFromWelcome = () => {
  sidebarRef.value?.openFolder?.()
}

const handleDemoFromWelcome = () => {
  sidebarRef.value?.initDemoWorkspace?.()
}

const handleCommandExecute = (command: string) => {
  showCommandPalette.value = false
  const actions: Record<string, () => void> = {
    'file.new': () => sidebarRef.value?.handleCreateFile?.(),
    'file.new-folder': () => sidebarRef.value?.handleCreateFolder?.(),
    'file.open': () => sidebarRef.value?.openFolder?.(),
    'file.open-folder': () => sidebarRef.value?.openFolder?.(),
    'file.new-from-template': () => { showTemplateGallery.value = true },
    'file.version-history': () => { showVersionHistory.value = true },
    'file.save': () => saveCurrentFile(),
    'file.export-md': () => exportAsMarkdown(),
    'file.export-html': () => exportAsHTML(),
    'edit.bold': () => editorRef.value?.wrapSelection?.('**', '**'),
    'edit.italic': () => editorRef.value?.wrapSelection?.('*', '*'),
    'edit.strikethrough': () => editorRef.value?.wrapSelection?.('~~', '~~'),
    'edit.heading1': () => editorRef.value?.insertLine?.('# '),
    'edit.heading2': () => editorRef.value?.insertLine?.('## '),
    'edit.heading3': () => editorRef.value?.insertLine?.('### '),
    'edit.code-block': () => editorRef.value?.insertLine?.('```\n\n```'),
    'edit.link': () => editorRef.value?.insertLink?.(),
    'edit.image': () => editorRef.value?.insertImage?.(),
    'view.sidebar': () => toggleSidebar(),
    'view.ai-panel': () => toggleAIPanel(),
    'view.source': () => editorStore.setViewMode('source'),
    'view.split': () => editorStore.setViewMode('split'),
    'view.preview': () => editorStore.setViewMode('preview'),
    'view.theme': () => toggleTheme(),
    'view.focus-mode': () => { focusMode.value = !focusMode.value },
    'view.cheatsheet': () => { showCheatsheet.value = true },
    'view.export': () => { showExportDialog.value = true },
    'file.export': () => { showExportDialog.value = true },
    'ai.clear': () => {},
    'ai.clear-chat': () => {},
    'ai.test': () => {},
    'ai.test-connection': () => {},
  }
  actions[command]?.()
}

let resizing = ''
let startPos = { x: 0, y: 0 }
let startSize = { w: 0, h: 0 }

const startResize = (panel: string, event: MouseEvent) => {
  resizing = panel
  startPos.x = event.clientX
  startPos.y = event.clientY
  if (panel === 'sidebar') startSize.w = settingsStore.sidebarWidth
  else if (panel === 'aiPanel') startSize.h = settingsStore.aiPanelHeight
  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
  document.body.style.cursor = panel === 'aiPanel' ? 'row-resize' : 'col-resize'
  document.body.style.userSelect = 'none'
}

const handleResize = (event: MouseEvent) => {
  if (!resizing) return
  if (resizing === 'sidebar') {
    const diff = event.clientX - startPos.x
    settingsStore.setSidebarWidth(Math.max(240, Math.min(400, startSize.w + diff)))
  } else if (resizing === 'aiPanel') {
    const diff = window.innerHeight - event.clientY - 28
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

const handleKeyDown = (e: KeyboardEvent) => {
  handleSaveKeyDown(e)
  const mod = e.ctrlKey || e.metaKey
  if (mod && e.key === 'b') {
    e.preventDefault()
    if (editorRef.value) editorRef.value.wrapSelection?.('**', '**')
  } else if (mod && e.key === 'i') {
    e.preventDefault()
    if (editorRef.value) editorRef.value.wrapSelection?.('*', '*')
  } else if (mod && e.key === 'k') {
    e.preventDefault()
    if (editorRef.value) editorRef.value.insertLink?.()
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
  } else if (e.key === 'Escape' && focusMode.value) {
    focusMode.value = false
  }
}

onMounted(async () => {
  settingsStore.applyTheme()
  try {
    await fileSystem.init()
    const restoredContent = await editorStore.hydrateRestoredSession()
    if (editorRef.value) {
      editorRef.value.setContent(restoredContent)
    }
  } catch {
    editorStore.setContentSilent('')
  }
  window.addEventListener('beforeunload', handleBeforeUnload)
  document.addEventListener('keydown', handleKeyDown)

  const sessionTimer = setInterval(() => {
    const session = getActiveSession()
    if (session) sessionDuration.value = getSessionDuration(session)
  }, 30000)

  const session = getActiveSession()
  if (session) sessionDuration.value = getSessionDuration(session)

  onUnmounted(() => clearInterval(sessionTimer))
})

watch(() => editorStore.content, () => {
  const session = updateSession(wordCount.value)
  sessionDuration.value = getSessionDuration(session)
})

onUnmounted(() => {
  stopResize()
  window.removeEventListener('beforeunload', handleBeforeUnload)
  document.removeEventListener('keydown', handleKeyDown)
})
</script>
