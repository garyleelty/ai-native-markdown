<template>
  <el-container class="app-container" :class="{ 'focus-mode-active': focusMode }" @dragenter="handleDragEnter" @dragleave="handleDragLeave" @dragover="handleDragOver" @drop="handleDrop">
    <CommandPalette
      v-model="showCommandPalette"
      :markdown-paths="markdownPaths"
      @execute="handleCommandExecute"
    />
    <TemplateGallery v-model="showTemplateGallery" @select="handleTemplateSelect" />
    <VersionHistoryPanel v-model="showVersionHistory" :file-path="editorStore.currentFile" @restore="handleVersionRestore" />
    <ExportDialog v-model="showExportDialog" :content="editorContent" :default-file-name="currentFileName" />
    <MarkdownCheatsheet v-model="showCheatsheet" />
    <FocusMode :active="focusMode" :file-name="currentFileName" :word-count="wordCount" @exit="focusMode = false" />
    <el-header class="app-header" height="48px">
      <div class="header-left">
        <el-tooltip content="切换侧边栏" placement="bottom">
          <el-button :icon="Operation" native-type="button" circle size="small" aria-label="切换侧边栏" @click="toggleSidebar" />
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
          <el-button :icon="ChatDotRound" native-type="button" circle size="small" aria-label="AI 助手" :type="settingsStore.showAIPanel ? 'primary' : 'default'" @click="toggleAIPanel" />
        </el-tooltip>
        <el-tooltip :content="viewModeTooltip" placement="bottom">
          <el-button :icon="editorStore.viewMode === 'preview' ? EditPen : View" native-type="button" circle size="small" aria-label="切换视图模式" @click="cycleViewMode" />
        </el-tooltip>
        <el-tooltip content="版本历史" placement="bottom" v-if="editorStore.currentFile">
          <el-button :icon="Clock" native-type="button" circle size="small" aria-label="版本历史" @click="showVersionHistory = true" />
        </el-tooltip>
        <el-dropdown trigger="click" @command="handleExport">
          <el-button :icon="Download" native-type="button" circle size="small" aria-label="导出" />
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="export">导出...</el-dropdown-item>
              <el-dropdown-item command="cheatsheet">Markdown 语法</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-tooltip content="专注模式 (F11)" placement="bottom">
          <el-button :icon="FullScreen" native-type="button" circle size="small" aria-label="专注模式" :type="focusMode ? 'primary' : 'default'" @click="focusMode = !focusMode" />
        </el-tooltip>
        <el-tooltip content="切换主题" placement="bottom">
          <el-button :icon="isDark ? Moon : Sunny" native-type="button" circle size="small" aria-label="切换主题" @click="toggleTheme" />
        </el-tooltip>
      </div>
    </el-header>

    <el-container class="main-container" :class="{ 'mobile-sidebar-open': isNarrowViewport && mobileSidebarOpen }">
      <Transition name="fade">
        <div
          v-if="isNarrowViewport && mobileSidebarOpen"
          class="mobile-sidebar-backdrop"
          aria-hidden="true"
          @click="closeMobileSidebar"
        />
      </Transition>
      <el-aside
        :width="sidebarAsideWidth"
        class="sidebar-aside"
        :class="{ 'is-mobile': isNarrowViewport, 'is-mobile-open': isNarrowViewport && mobileSidebarOpen }"
      >
        <Sidebar
          v-if="sidebarVisible"
          ref="sidebarRef"
          :is-dark="isDark"
          :show-a-i="settingsStore.showAIPanel"
          :current-file="editorStore.currentFile"
          :editor-content="editorContent"
          :cursor-line="editorStore.cursorLine"
          @select="handleFileSelect"
          @search-result-select="handleSearchResultSelect"
          @reference-select="handleKnowledgeReferenceSelect"
          @wiki-navigate="handleWikiNavigate"
          @link-mention="handleLinkMention"
          @set-theme="setThemeFromSwitch"
          @toggle-ai="toggleAIPanel"
          @navigate="handleOutlineNavigate"
          @renamed="handleFileTreeRename"
          @deleted="handleFileTreeDelete"
        />
        <div v-if="sidebarVisible && !isNarrowViewport" class="resize-handle-v" @mousedown="startResize('sidebar', $event)" />
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
              :current-file="editorStore.currentFile"
              :markdown-paths="markdownPaths"
              :read-markdown-file="readMarkdownFileForCompletion"
              @update="handleEditorUpdate"
              @cursor-change="handleCursorChange"
              @selection-change="handleSelectionChange"
              class="editor-pane"
            />
            <Preview
              v-if="editorStore.viewMode !== 'source'"
              ref="previewRef"
              :content="editorContent"
              :cursor-line="editorStore.cursorLine"
              :current-file="editorStore.currentFile"
              :markdown-paths="markdownPaths"
              class="preview-pane"
              @heading-click="handleOutlineNavigate"
              @navigate="handleWikiNavigate"
            />
          </div>
        </el-main>

        <Transition name="ai-slide">
          <div v-if="settingsStore.showAIPanel" class="ai-panel-section" :style="{ height: settingsStore.aiPanelHeight + 'px' }">
            <div class="resize-handle-h" @mousedown="startResize('aiPanel', $event)" />
            <ChatPanel
              ref="chatPanelRef"
              :context="selectedText || editorContent.slice(0, 2000)"
              @insert="handleAIInsert"
            />
          </div>
        </Transition>
      </el-container>
    </el-container>

    <el-footer class="status-bar" height="28px">
      <span class="status-item status-format">
        <el-tag size="small" type="info" effect="plain" disable-transitions>Markdown</el-tag>
      </span>
      <span class="status-item status-line" v-if="editorStore.cursorLine > 0">行 {{ editorStore.cursorLine }}</span>
      <span class="status-spacer" />
      <span class="status-item status-save" :class="saveStatusClass">
        <span v-if="saveStatusMessage" class="save-status">{{ saveStatusMessage }}</span>
        <template v-else-if="editorStore.isModified">
          <span class="status-dot saving" />
          未保存
        </template>
        <template v-else>
          已保存
        </template>
      </span>
      <button class="status-item view-mode-btn" type="button" @click="cycleViewMode">
        {{ viewModeLabel }}
      </button>
      <DocumentStats :content="editorContent">
        <span class="status-item status-clickable status-stats">{{ wordCount }} 词 · {{ editorContent.length }} 字符</span>
      </DocumentStats>
      <span class="status-item status-duration" v-if="sessionDuration">{{ sessionDuration }}</span>
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
import { ref, computed, nextTick, onMounted, onUnmounted, watch, defineAsyncComponent } from 'vue'
import { ElMessage } from 'element-plus'
import { Operation, Document, ChatDotRound, View, EditPen, Download, Moon, Sunny, Clock, Upload, FullScreen } from '@element-plus/icons-vue'
import { useSettingsStore } from './stores/settings'
import { useEditorStore } from './stores/editor'
import { aiService, configureAIProvider } from './services/ai'
import { fileSystem } from './services/fileSystem'
import type { KnowledgeReference } from './services/knowledgeIndex'
import { useFileOperations } from './composables/useFileOperations'
import { useExport } from './composables/useExport'
import type { SidebarTab, ViewMode } from './types'
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
import { safeStorage } from './utils/security'
import { createWikiLinkInitialContent, findMarkdownHeadingLine, getCreatableWikiLinkPath, linkFirstUnlinkedMention, parseWikiLinkTarget, resolveWikiLinkTarget, updateWikiLinksForRename } from './utils/wikiLinks'
import { getActiveSession, updateSession, getSessionDuration } from './utils/writingSession'

const TemplateGallery = defineAsyncComponent(() => import('./components/TemplateGallery.vue'))
const VersionHistoryPanel = defineAsyncComponent(() => import('./components/editor/VersionHistoryPanel.vue'))
const ExportDialog = defineAsyncComponent(() => import('./components/ExportDialog.vue'))
const MarkdownCheatsheet = defineAsyncComponent(() => import('./components/MarkdownCheatsheet.vue'))
const settingsStore = useSettingsStore()
const editorStore = useEditorStore()

const editorRef = ref()
const previewRef = ref()
const chatPanelRef = ref<{ clearMessages?: () => void } | null>(null)
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
const markdownPaths = ref<string[]>([])
const narrowViewportBreakpoint = 768
const viewportWidth = ref(typeof window === 'undefined' ? 1024 : window.innerWidth)
const mobileSidebarOpen = ref(false)

const {
  saveStatusMessage,
  saveStatusClass,
  saveCurrentFile,
  handleFileSelect: selectFileFromOperations,
  handleCloseTab,
  handleTabChange,
  handleTemplateSelect: createFromTemplate,
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
const isNarrowViewport = computed(() => viewportWidth.value <= narrowViewportBreakpoint)
const sidebarVisible = computed(() => isNarrowViewport.value ? mobileSidebarOpen.value : settingsStore.showSidebar)
const sidebarAsideWidth = computed(() => {
  if (!sidebarVisible.value) return '0px'
  if (!isNarrowViewport.value) return `${settingsStore.sidebarWidth}px`
  return `${Math.min(settingsStore.sidebarWidth, Math.floor(viewportWidth.value * 0.86))}px`
})

const currentFileName = computed(() => editorStore.currentFile?.split('/').pop()?.replace(/\.md$/i, '') || 'document')

const activeTabModel = computed({
  get: () => editorStore.activeTabId || '',
  set: (id: string) => { if (id) editorStore.switchTab(id) }
})

const closeMobileSidebar = () => {
  mobileSidebarOpen.value = false
}

type MobileReadableViewMode = Exclude<ViewMode, 'split'>

const preferReadableMobileView = (
  mode: MobileReadableViewMode = 'source',
  options: { force?: boolean } = {}
) => {
  if (!isNarrowViewport.value || editorStore.openTabs.length === 0) return
  if (options.force || editorStore.viewMode === 'split') {
    editorStore.setViewMode(mode)
  }
}

const ensureMobileSidebar = async () => {
  if (!isNarrowViewport.value) {
    settingsStore.setSidebarVisible(true)
  } else {
    mobileSidebarOpen.value = true
  }
  await nextTick()
}

const toggleSidebar = () => {
  if (isNarrowViewport.value) {
    mobileSidebarOpen.value = !mobileSidebarOpen.value
  } else {
    settingsStore.toggleSidebar()
  }
}
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
const refreshMarkdownPaths = async () => {
  try {
    markdownPaths.value = (await fileSystem.getAllMarkdownFiles()).map(file => file.path)
  } catch {
    markdownPaths.value = []
  }
}
const readMarkdownFileForCompletion = async (path: string): Promise<string> => {
  const openTab = editorStore.openTabs.find(tab => tab.filePath === path)
  if (openTab) return openTab.content
  return fileSystem.readFile(path)
}
const handleFileSelect = async (
  filePath: string,
  options: { mobileViewMode?: MobileReadableViewMode; forceMobileViewMode?: boolean } = {}
) => {
  await selectFileFromOperations(filePath)
  preferReadableMobileView(options.mobileViewMode, { force: options.forceMobileViewMode })
  await refreshMarkdownPaths()
  closeMobileSidebar()
}
const handleSearchResultSelect = async (payload: { path: string; lineNumber?: number }) => {
  await handleFileSelect(payload.path)
  if (payload.lineNumber) {
    await nextTick()
    await handleOutlineNavigate(payload.lineNumber)
  }
}
const handleOutlineNavigate = async (lineNumber: number) => {
  editorStore.setCursor(lineNumber, 0)
  await nextTick()
  if (editorRef.value) editorRef.value.scrollToLine?.(lineNumber)
  if (previewRef.value) previewRef.value.scrollToLine?.(lineNumber)
}
const handleWikiNavigate = async (target: string) => {
  try {
    const markdownFiles = await fileSystem.getAllMarkdownFiles()
    markdownPaths.value = markdownFiles.map(file => file.path)
    const parsedTarget = parseWikiLinkTarget(target)
    const currentPath = editorStore.currentFile
    const resolvedPath = resolveWikiLinkTarget(
      target,
      currentPath,
      markdownFiles.map(file => file.path)
    )
    if (!resolvedPath) {
      const creatablePath = getCreatableWikiLinkPath(target, currentPath)
      if (!creatablePath) {
        ElMessage.warning(`未找到链接目标: ${target}`)
        return
      }
      await fileSystem.writeFile(creatablePath, createWikiLinkInitialContent(target))
      await refreshMarkdownPaths()
      await sidebarRef.value?.refreshTree?.()
      await handleFileSelect(creatablePath)
      ElMessage.success(`已创建 ${creatablePath.split('/').pop()}`)
      return
    }
    const resolvedFile = markdownFiles.find(file => file.path === resolvedPath)
    const headingContent = resolvedPath === currentPath ? editorContent.value : resolvedFile?.content
    if (resolvedPath !== currentPath) {
      await handleFileSelect(resolvedPath)
      await refreshMarkdownPaths()
    }
    const headingLine = parsedTarget.heading
      ? findMarkdownHeadingLine(headingContent || '', parsedTarget.heading)
      : null
    if (headingLine) {
      await handleOutlineNavigate(headingLine)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    ElMessage.error(`打开链接失败: ${message}`)
  }
}
const handleKnowledgeReferenceSelect = async (reference: KnowledgeReference) => {
  await handleFileSelect(reference.filePath)
  if (reference.lineNumber && editorStore.currentFile === reference.filePath) {
    await nextTick()
    await handleOutlineNavigate(reference.lineNumber)
  }
}
const handleLinkMention = async (payload: { reference: KnowledgeReference; targetTitle: string; targetNames: string[] }) => {
  try {
    const sourceTab = editorStore.openTabs.find(tab => tab.filePath === payload.reference.filePath)
    const sourceContent = sourceTab?.content ?? await fileSystem.readFile(payload.reference.filePath)
    const updatedContent = linkFirstUnlinkedMention(
      sourceContent,
      payload.targetNames,
      payload.targetTitle,
      { lineNumber: payload.reference.lineNumber }
    )
    if (!updatedContent) {
      ElMessage.warning('没有找到可安全链接的提及')
      return
    }

    await fileSystem.writeFile(payload.reference.filePath, updatedContent)
    if (sourceTab) {
      sourceTab.content = updatedContent
      sourceTab.isModified = false
    }
    if (editorStore.currentFile === payload.reference.filePath) {
      editorStore.setContentSilent(updatedContent)
      editorRef.value?.setContent(updatedContent)
    }
    await refreshMarkdownPaths()
    ElMessage.success('已链接提及')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    ElMessage.error(`链接提及失败: ${message}`)
  }
}
const handleAIInsert = (text: string) => {
  if (editorRef.value) editorRef.value.insertText(text)
}

const handleTemplateSelect = async (content: string, name: string) => {
  await createFromTemplate(content, name)
  preferReadableMobileView()
}

const syncEditorFromActiveTab = () => {
  const activeTab = editorStore.getActiveTab()
  const nextContent = activeTab?.content || ''
  if (editorRef.value) {
    editorRef.value.setContent(nextContent)
  }
}

const getPathBeforeRename = (path: string, oldPath: string, newPath: string, isDirectory: boolean): string => {
  if (path === newPath) return oldPath
  if (isDirectory && path.startsWith(`${newPath}/`)) {
    return `${oldPath}${path.slice(newPath.length)}`
  }
  return path
}

const isMarkdownPath = (path: string): boolean => /\.(md|markdown)$/i.test(path)

type FileTreeRenamePayload = {
  oldPath: string
  newPath: string
  isDirectory: boolean
  renamedPaths?: Array<{ oldPath: string; newPath: string; isDirectory: boolean }>
  updatedLinkPaths?: string[]
}

const syncOpenTabWikiLinksForRename = (
  payload: FileTreeRenamePayload,
  markdownPathsBeforeRename: string[]
) => {
  for (const tab of editorStore.openTabs) {
    if (!isMarkdownPath(tab.filePath)) continue
    const wasModified = tab.isModified
    const updatedContent = updateWikiLinksForRename(tab.content, {
      sourcePath: tab.filePath,
      sourcePathBeforeRename: getPathBeforeRename(tab.filePath, payload.oldPath, payload.newPath, payload.isDirectory),
      oldPath: payload.oldPath,
      newPath: payload.newPath,
      isDirectory: payload.isDirectory,
      markdownPathsBeforeRename,
    })
    if (updatedContent === tab.content) continue

    if (tab.id === editorStore.activeTabId) {
      if (wasModified) editorStore.setContent(updatedContent)
      else editorStore.setContentSilent(updatedContent)
      editorRef.value?.setContent(updatedContent)
    } else {
      tab.content = updatedContent
      tab.isModified = wasModified
    }
  }
}

const handleFileTreeRename = (payload: FileTreeRenamePayload) => {
  const openMarkdownPathsBeforeRename = editorStore.openTabs
    .filter(tab => isMarkdownPath(tab.filePath))
    .map(tab => tab.filePath)
  const renamedMarkdownPathsBeforeRename = payload.renamedPaths
    ? payload.renamedPaths.filter(item => !item.isDirectory && isMarkdownPath(item.oldPath)).map(item => item.oldPath)
    : (!payload.isDirectory && isMarkdownPath(payload.oldPath) ? [payload.oldPath] : [])
  const markdownPathsBeforeRename = Array.from(new Set([
    ...markdownPaths.value,
    ...openMarkdownPathsBeforeRename,
    ...renamedMarkdownPathsBeforeRename,
  ]))
  editorStore.renameOpenPath(payload.oldPath, payload.newPath, payload.isDirectory)
  syncOpenTabWikiLinksForRename(payload, markdownPathsBeforeRename)
  syncEditorFromActiveTab()
  void refreshMarkdownPaths()
}

const handleFileTreeDelete = (payload: { path: string; isDirectory: boolean }) => {
  editorStore.removeOpenPath(payload.path, payload.isDirectory)
  syncEditorFromActiveTab()
  void refreshMarkdownPaths()
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

  let importedCount = 0
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
        preferReadableMobileView()
        importedCount++
      } catch (e: any) {
        ElMessage.error(`导入 ${file.name} 失败`)
      }
    }
  }
  await refreshMarkdownPaths()
  if (importedCount > 0) {
    ElMessage.success(`已导入 ${importedCount} 个 Markdown 文件`)
  } else {
    ElMessage.warning('未导入文件：仅支持 Markdown 文件')
  }
}

const handleNewFileFromWelcome = () => {
  void (async () => {
    await ensureMobileSidebar()
    sidebarRef.value?.handleCreateFile?.()
  })()
}

const handleOpenFolderFromWelcome = async () => {
  await ensureMobileSidebar()
  await sidebarRef.value?.openFolder?.()
  await refreshMarkdownPaths()
}

const handleDemoFromWelcome = async () => {
  await ensureMobileSidebar()
  await sidebarRef.value?.initDemoWorkspace?.()
  await refreshMarkdownPaths()
  try {
    await handleFileSelect('/workspace/README.md', {
      mobileViewMode: 'preview',
      forceMobileViewMode: true,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    ElMessage.warning(`示例工作区已加载，但打开 README 失败: ${message}`)
  }
}

const getLocalDateStamp = (date = new Date()): string => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, '0'),
  String(date.getDate()).padStart(2, '0'),
].join('-')

const createDailyNoteContent = (dateStamp: string): string => [
  '---',
  `date: ${dateStamp}`,
  'tags: [daily]',
  '---',
  '',
  `# ${dateStamp}`,
  '',
  '## 今日重点',
  '',
  '- ',
  '',
  '## 记录',
  '',
].join('\n')

const ensureDailyDirectory = async (): Promise<void> => {
  try {
    await fileSystem.createDirectory('/workspace/Daily')
  } catch {
    await fileSystem.readDirectory('/workspace/Daily')
  }
}

const handleOpenDailyNote = async () => {
  try {
    const dateStamp = getLocalDateStamp()
    const path = `/workspace/Daily/${dateStamp}.md`
    let created = false

    await ensureDailyDirectory()
    try {
      await fileSystem.readFile(path)
    } catch {
      await fileSystem.writeFile(path, createDailyNoteContent(dateStamp))
      created = true
    }

    await refreshMarkdownPaths()
    await sidebarRef.value?.refreshTree?.()
    await handleFileSelect(path)
    ElMessage.success(created ? '已创建今日笔记' : '已打开今日笔记')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    ElMessage.error(`打开今日笔记失败: ${message}`)
  }
}

const handleClearAIChat = () => {
  chatPanelRef.value?.clearMessages?.()
  safeStorage.set('ai_chat_history', [])
  ElMessage.success('已清空对话')
}

const handleTestAIConnection = async () => {
  const provider = aiService.getActiveProvider()
  if (!provider) {
    ElMessage.warning('AI Provider 未就绪，请在 AI 配置中检查模型和连接')
    return
  }

  try {
    const result = await provider.testConnection()
    if (result.ok) {
      ElMessage.success(result.error ? `AI 连接成功：${result.error}` : 'AI 连接成功')
    } else {
      ElMessage.error(result.error || 'AI 连接失败')
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    ElMessage.error(`AI 连接失败: ${message}`)
  }
}

const openSidebarTab = async (tab: SidebarTab) => {
  await ensureMobileSidebar()
  sidebarRef.value?.openTab?.(tab)
}

const refreshKnowledgeIndexFromCommand = async () => {
  try {
    await ensureMobileSidebar()
    const sidebar = sidebarRef.value
    if (!sidebar?.refreshKnowledgeIndex) {
      throw new Error('知识面板未就绪')
    }
    await sidebar.refreshKnowledgeIndex()
    ElMessage.success('知识索引已刷新')
  } catch {
    ElMessage.error('刷新知识索引失败')
  }
}

const focusFileSearchFromCommand = async (mode: 'name' | 'content') => {
  await ensureMobileSidebar()
  await sidebarRef.value?.focusFileSearch?.(mode)
}

const openFolderFromCommand = async () => {
  await ensureMobileSidebar()
  await sidebarRef.value?.openFolder?.()
  await refreshMarkdownPaths()
}

const handleCommandExecute = (command: string) => {
  showCommandPalette.value = false
  const quickOpenPrefix = 'file.quick-open:'
  if (command.startsWith(quickOpenPrefix)) {
    void handleFileSelect(command.slice(quickOpenPrefix.length))
    return
  }

  const actions: Record<string, () => void | Promise<void>> = {
    'file.new': () => sidebarRef.value?.handleCreateFile?.(),
    'file.new-folder': () => sidebarRef.value?.handleCreateFolder?.(),
    'file.open': () => openFolderFromCommand(),
    'file.open-folder': () => openFolderFromCommand(),
    'file.new-from-template': () => { showTemplateGallery.value = true },
    'file.daily-note': () => { void handleOpenDailyNote() },
    'file.version-history': () => { showVersionHistory.value = true },
    'file.save': () => saveCurrentFile(),
    'file.export-md': () => exportAsMarkdown(),
    'file.export-html': () => exportAsHTML(),
    'search.file-name': () => focusFileSearchFromCommand('name'),
    'search.content': () => focusFileSearchFromCommand('content'),
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
    'view.files-panel': () => openSidebarTab('files'),
    'view.knowledge-panel': () => openSidebarTab('graph'),
    'view.ai-settings': () => openSidebarTab('ai'),
    'view.outline': () => openSidebarTab('outline'),
    'view.settings': () => openSidebarTab('settings'),
    'view.source': () => editorStore.setViewMode('source'),
    'view.split': () => editorStore.setViewMode('split'),
    'view.preview': () => editorStore.setViewMode('preview'),
    'view.theme': () => toggleTheme(),
    'view.focus-mode': () => { focusMode.value = !focusMode.value },
    'view.cheatsheet': () => { showCheatsheet.value = true },
    'view.export': () => { showExportDialog.value = true },
    'file.export': () => { showExportDialog.value = true },
    'ai.clear': () => handleClearAIChat(),
    'ai.clear-chat': () => handleClearAIChat(),
    'ai.test': () => { void handleTestAIConnection() },
    'ai.test-connection': () => { void handleTestAIConnection() },
    'knowledge.refresh-index': () => refreshKnowledgeIndexFromCommand(),
  }
  void actions[command]?.()
}

let resizing = ''
let startPos = { x: 0, y: 0 }
let startSize = { w: 0, h: 0 }

const startResize = (panel: string, event: MouseEvent) => {
  if (panel === 'sidebar' && isNarrowViewport.value) return
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
  } else if (e.key === 'Escape' && mobileSidebarOpen.value) {
    closeMobileSidebar()
  } else if (e.key === 'Escape' && focusMode.value) {
    focusMode.value = false
  }
}

const updateViewportWidth = () => {
  viewportWidth.value = window.innerWidth
  if (!isNarrowViewport.value) closeMobileSidebar()
}

let sessionTimer: ReturnType<typeof setInterval> | null = null
let isAppDisposed = false

onMounted(async () => {
  configureAIProvider(settingsStore.aiConfig)
  settingsStore.applyTheme()
  updateViewportWidth()
  window.addEventListener('resize', updateViewportWidth)
  window.addEventListener('beforeunload', handleBeforeUnload)
  document.addEventListener('keydown', handleKeyDown)
  try {
    await fileSystem.init()
    if (isAppDisposed) return
    const restoredContent = await editorStore.hydrateRestoredSession()
    if (isAppDisposed) return
    if (editorRef.value) {
      editorRef.value.setContent(restoredContent)
    }
    preferReadableMobileView()
    await refreshMarkdownPaths()
  } catch {
    if (!isAppDisposed) editorStore.setContentSilent('')
  }

  if (isAppDisposed) return
  sessionTimer = setInterval(() => {
    const session = getActiveSession()
    if (session) sessionDuration.value = getSessionDuration(session)
  }, 30000)

  const session = getActiveSession()
  if (session) sessionDuration.value = getSessionDuration(session)
})

watch(() => editorStore.content, () => {
  const session = updateSession(wordCount.value)
  sessionDuration.value = getSessionDuration(session)
})

watch(() => editorStore.viewMode, (mode) => {
  if (mode !== 'source') void refreshMarkdownPaths()
})

watch(isNarrowViewport, (narrow) => {
  if (narrow) preferReadableMobileView()
})

watch(showCommandPalette, (open) => {
  if (open) void refreshMarkdownPaths()
})

onUnmounted(() => {
  isAppDisposed = true
  stopResize()
  if (sessionTimer !== null) {
    clearInterval(sessionTimer)
    sessionTimer = null
  }
  window.removeEventListener('resize', updateViewportWidth)
  window.removeEventListener('beforeunload', handleBeforeUnload)
  document.removeEventListener('keydown', handleKeyDown)
})
</script>
