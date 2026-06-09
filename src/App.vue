<template>
  <el-container class="app-container" :class="{ 'focus-mode-active': focusMode }" @dragenter="handleDragEnter" @dragleave="handleDragLeave" @dragover="handleDragOver" @drop="handleDrop">
    <CommandPalette
      v-model="showCommandPalette"
      :markdown-paths="markdownPaths"
      @execute="handleCommandExecute"
    />
    <TemplateGallery v-model="showTemplateGallery" @select="handleTemplateSelect" />
    <VersionHistoryPanel v-model="showVersionHistory" :file-path="editorStore.currentFile" @restore="handleVersionRestore" />
    <ExportDialog v-model="showExportDialog" :content="editorContent" :default-file-name="currentFileName" :current-file="editorStore.currentFile" />
    <MarkdownCheatsheet v-model="showCheatsheet" />
    <MigrationAuditDialog
      v-model="showMigrationAudit"
      :report="migrationAuditReport"
      :running="migrationAuditRunning"
      :asset-repair-preview="migrationAssetRepairPreview"
      :asset-repair-result="migrationAssetRepairResult"
      @rerun="openMigrationAudit"
      @create-missing-notes="createMigrationAuditMissingNotes"
      @create-missing-sections="createMigrationAuditMissingSections"
      @preview-missing-assets="previewMigrationAuditMissingAssets"
      @preview-missing-asset="previewMigrationAuditMissingAsset"
      @confirm-asset-repair="confirmMigrationAuditAssetRepair"
      @cancel-asset-repair-preview="cancelMigrationAuditAssetRepairPreview"
      @open-asset-repair-history="openMigrationAuditAssetRepairHistory"
      @navigate="handleMigrationAuditNavigate"
    />
    <FocusMode :active="focusMode" :file-name="currentFileName" :word-count="wordCount" @exit="focusMode = false" />
    <el-header class="app-header" height="48px">
      <div class="header-left">
        <el-tooltip content="切换侧边栏" placement="bottom">
          <el-button :icon="Operation" native-type="button" circle size="small" aria-label="切换侧边栏" @click="toggleSidebar" />
        </el-tooltip>
        <div class="app-brand">
          <span class="brand-emoji">✦</span>
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
        <el-tooltip content="图谱工作区" placement="bottom">
          <el-button :icon="Share" native-type="button" circle size="small" aria-label="图谱工作区" :type="settingsStore.showGraphPane ? 'primary' : 'default'" @click="toggleGraphPane" />
        </el-tooltip>
        <el-tooltip content="右侧工作台" placement="bottom">
          <el-button :icon="Tickets" native-type="button" circle size="small" aria-label="右侧工作台" :type="settingsStore.showRightDock ? 'primary' : 'default'" @click="toggleRightDock" />
        </el-tooltip>
        <el-tooltip :content="viewModeTooltip" placement="bottom">
          <el-button :icon="editorStore.viewMode === 'preview' ? View : EditPen" native-type="button" circle size="small" aria-label="切换视图模式" @click="cycleViewMode" />
        </el-tooltip>
        <el-tooltip content="版本历史" placement="bottom" v-if="editorStore.currentFile">
          <el-button :icon="Clock" native-type="button" circle size="small" aria-label="版本历史" @click="showVersionHistory = true" />
        </el-tooltip>
        <el-dropdown trigger="click" hide-on-click @command="handleExport">
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
          @content-change="handlePropertiesContentChange"
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
            @open-file="handleFileSelect"
          />
          <div v-else class="editor-workspace">
            <div
              v-if="externalConflicts.length > 0 && !currentExternalConflict"
              class="vault-conflict-overview"
              role="status"
            >
              <div class="vault-conflict-overview-message">
                <el-icon><WarningFilled /></el-icon>
                <span>{{ formatExternalConflictOverviewMessage() }}</span>
              </div>
              <div class="vault-conflict-file-list" aria-label="冲突文件列表">
                <button
                  v-for="conflict in externalConflicts"
                  :key="conflict.path"
                  class="vault-conflict-chip"
                  type="button"
                  :title="conflict.path"
                  :aria-label="`查看冲突 ${formatConflictFileName(conflict.path)}`"
                  @click="focusExternalConflict(conflict.path)"
                >
                  {{ formatConflictFileName(conflict.path) }}
                </button>
              </div>
            </div>
            <div
              v-if="currentExternalConflict"
              class="vault-conflict-banner"
              :class="{
                'is-missing': currentExternalConflict.diskState === 'missing',
                'is-unreadable': currentExternalConflict.diskState === 'unreadable'
              }"
              role="status"
            >
              <div class="vault-conflict-topline">
                <div class="vault-conflict-message">
                  <el-icon><WarningFilled /></el-icon>
                  <span>{{ formatExternalConflictMessage(currentExternalConflict) }}</span>
                </div>
                <div class="vault-conflict-actions">
                  <el-button
                    v-if="isExternalConflictReloadable(currentExternalConflict)"
                    size="small"
                    :icon="RefreshLeft"
                    native-type="button"
                    @click="reloadCurrentConflictFromDisk"
                  >重新载入磁盘版本</el-button>
                  <el-button size="small" :icon="Clock" native-type="button" @click="saveCurrentConflictSnapshot">保存本地快照</el-button>
                  <el-button size="small" :icon="Clock" native-type="button" @click="openCurrentConflictVersionHistory">版本历史</el-button>
                  <el-button size="small" :icon="Select" native-type="button" @click="keepCurrentConflictLocal">保留本地版本</el-button>
                </div>
              </div>
              <div
                v-if="otherExternalConflicts.length > 0"
                class="vault-conflict-related"
                aria-label="其它冲突文件"
              >
                <span>另有 {{ otherExternalConflicts.length }} 个冲突</span>
                <div class="vault-conflict-file-list">
                  <button
                    v-for="conflict in otherExternalConflicts"
                    :key="conflict.path"
                    class="vault-conflict-chip"
                    type="button"
                    :title="conflict.path"
                    :aria-label="`查看冲突 ${formatConflictFileName(conflict.path)}`"
                    @click="focusExternalConflict(conflict.path)"
                  >
                    {{ formatConflictFileName(conflict.path) }}
                  </button>
                </div>
              </div>
              <div class="vault-conflict-diff" aria-label="冲突差异预览">
                <div class="vault-conflict-summary">{{ formatExternalConflictSummary(currentExternalConflict) }}</div>
                <div class="vault-conflict-lines">
                  <div
                    v-for="(line, index) in buildExternalConflictPreview(currentExternalConflict)"
                    :key="`${line.type}-${line.lineNumber}-${index}`"
                    class="vault-conflict-line"
                    :class="line.type"
                  >
                    <span class="vault-conflict-marker">{{ formatConflictLineMarker(line.type) }}</span>
                    <span class="vault-conflict-line-number">{{ line.lineNumber ? `L${line.lineNumber}` : '' }}</span>
                    <span class="vault-conflict-line-content">{{ line.content || ' ' }}</span>
                  </div>
                </div>
              </div>
            </div>
            <div class="editor-preview-view">
              <Editor
                v-if="editorStore.viewMode !== 'preview'"
                ref="editorRef"
                v-model="editorContent"
                :current-file="editorStore.currentFile"
                :markdown-paths="markdownPaths"
                :read-markdown-file="readMarkdownFileForCompletion"
                :embed-refresh-key="embedRefreshKey"
                :live-preview="editorStore.viewMode === 'live-preview'"
                @update="handleEditorUpdate"
                @cursor-change="handleCursorChange"
                @selection-change="handleSelectionChange"
                @embed-navigate="handleWikiNavigate"
                @toggle-live-preview="handleToggleLivePreview"
                class="editor-pane"
              />
              <Preview
                v-if="editorStore.viewMode === 'preview'"
                ref="previewRef"
                :content="editorContent"
                :cursor-line="editorStore.cursorLine"
                :current-file="editorStore.currentFile"
                :markdown-paths="markdownPaths"
                :embed-refresh-key="embedRefreshKey"
                class="preview-pane"
                @heading-click="handleOutlineNavigate"
                @navigate="handleWikiNavigate"
              />
            </div>
          </div>
        </el-main>

        <Transition name="ai-slide">
          <div v-if="settingsStore.showAIPanel" class="ai-panel-section" :style="{ height: settingsStore.aiPanelHeight + 'px' }">
            <div class="resize-handle-h" @mousedown="startResize('aiPanel', $event)" />
            <ChatPanel
              ref="chatPanelRef"
              :context="selectedText || editorContent.slice(0, 2000)"
              @insert="handleAIInsert"
              @open-source="handleAIRAGSourceOpen"
            />
          </div>
        </Transition>
      </el-container>

      <Transition name="workbench-pane">
        <div
          v-if="showDesktopGraphPane"
          class="graph-pane-shell"
          :style="{ width: settingsStore.graphPaneWidth + 'px' }"
        >
          <div class="workbench-resize-handle is-left" @mousedown="startResize('graphPane', $event)" />
          <GraphWorkbenchPane
            :current-file="editorStore.currentFile"
            @select="handleFileSelect"
            @close="settingsStore.setGraphPaneVisible(false)"
          />
        </div>
      </Transition>

      <Transition name="workbench-pane">
        <div
          v-if="showDesktopRightDock"
          class="right-dock-shell"
          :style="{ width: settingsStore.rightDockWidth + 'px' }"
        >
          <div class="workbench-resize-handle is-left" @mousedown="startResize('rightDock', $event)" />
          <RightDock
            :current-file="editorStore.currentFile"
            :editor-content="editorContent"
            :cursor-line="editorStore.cursorLine"
            @close="settingsStore.setRightDockVisible(false)"
            @navigate="handleOutlineNavigate"
            @select="handleFileSelect"
            @reference-select="handleKnowledgeReferenceSelect"
            @wiki-navigate="handleWikiNavigate"
            @link-mention="handleLinkMention"
            @content-change="handlePropertiesContentChange"
          />
        </div>
      </Transition>
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
import { Operation, Document, ChatDotRound, View, EditPen, Download, Moon, Sunny, Clock, Upload, FullScreen, WarningFilled, RefreshLeft, Select, Share, Tickets } from '@element-plus/icons-vue'
import { useSettingsStore } from './stores/settings'
import { useEditorStore } from './stores/editor'
import { aiService, configureAIProvider } from './services/ai'
import { vaultService } from './services/vault'
import { embedSyncService } from './services/embedSyncService'
import { versionHistory } from './services/versionHistory'
import { createMissingHeadingsAndBlocksFromAuditReport, createMissingNotesFromAuditReport, previewMissingAssetLinksFromAuditReport, repairMissingAssetLinksFromAuditReport, runMigrationAudit, type MigrationAuditAssetRepairResult, type MigrationAuditIssue, type MigrationAuditReport } from './services/migrationAudit'
import type { VaultChangeEvent } from './services/vault'
import type { KnowledgeReference } from './services/knowledgeIndex'
import { useFileOperations } from './composables/useFileOperations'
import { useExport } from './composables/useExport'
import type { SidebarTab, ViewMode } from './types'
import './styles/app.css'
import Sidebar from './components/Sidebar.vue'
import Editor from './components/Editor.vue'
import Preview from './components/Preview.vue'
import ChatPanel from './components/ai-panel/ChatPanel.vue'
import GraphWorkbenchPane from './components/workbench/GraphWorkbenchPane.vue'
import RightDock from './components/workbench/RightDock.vue'
import CommandPalette from './components/CommandPalette.vue'
import MigrationAuditDialog from './components/MigrationAuditDialog.vue'
import WelcomePage from './components/WelcomePage.vue'
import DocumentStats from './components/editor/DocumentStats.vue'
import FocusMode from './components/editor/FocusMode.vue'
import WritingGoal from './components/editor/WritingGoal.vue'
import { safeStorage } from './utils/security'
import { createWikiLinkInitialContent, findMarkdownBlockLine, findMarkdownHeadingLine, getCreatableWikiLinkPath, linkFirstUnlinkedMention, parseWikiLinkTarget, resolveWikiLinkTarget, updateWikiLinksForRename } from './utils/wikiLinks'
import { getActiveSession, updateSession, getSessionDuration } from './utils/writingSession'

const TemplateGallery = defineAsyncComponent(() => import('./components/TemplateGallery.vue'))
const VersionHistoryPanel = defineAsyncComponent(() => import('./components/editor/VersionHistoryPanel.vue'))
const ExportDialog = defineAsyncComponent({
  loader: () => import('./components/ExportDialog.vue'),
  delay: 0,
})
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
const showMigrationAudit = ref(false)
const migrationAuditRunning = ref(false)
const migrationAuditReport = ref<MigrationAuditReport | null>(null)
const migrationAssetRepairPreview = ref<MigrationAuditAssetRepairResult | null>(null)
const migrationAssetRepairPreviewIssues = ref<MigrationAuditIssue[]>([])
const migrationAssetRepairResult = ref<MigrationAuditAssetRepairResult | null>(null)
const sessionDuration = ref('')
const markdownPaths = ref<string[]>([])
const embedRefreshKey = ref(0)
const narrowViewportBreakpoint = 768
const viewportWidth = ref(typeof window === 'undefined' ? 1024 : window.innerWidth)
const mobileSidebarOpen = ref(false)

type ExternalConflictDiskState = 'changed' | 'missing' | 'unreadable'

interface ExternalConflictRecord {
  path: string
  localContent: string
  diskContent: string
  diskState: ExternalConflictDiskState
  changedAt: number
}

interface ExternalConflictPreviewLine {
  type: 'local' | 'disk'
  lineNumber: number
  content: string
}

const externalConflicts = ref<ExternalConflictRecord[]>([])

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
const showDesktopGraphPane = computed(() => !isNarrowViewport.value && viewportWidth.value >= 1320 && settingsStore.showGraphPane && editorStore.openTabs.length > 0)
const showDesktopRightDock = computed(() => !isNarrowViewport.value && viewportWidth.value >= 1040 && settingsStore.showRightDock && editorStore.openTabs.length > 0)
const sidebarAsideWidth = computed(() => {
  if (!sidebarVisible.value) return '0px'
  if (!isNarrowViewport.value) return `${settingsStore.sidebarWidth}px`
  return `${Math.min(settingsStore.sidebarWidth, Math.floor(viewportWidth.value * 0.86))}px`
})

const currentFileName = computed(() => editorStore.currentFile?.split('/').pop()?.replace(/\.md$/i, '') || 'document')
const currentExternalConflict = computed(() => (
  editorStore.currentFile
    ? externalConflicts.value.find(conflict => conflict.path === editorStore.currentFile) || null
    : null
))
const otherExternalConflicts = computed(() => (
  editorStore.currentFile
    ? externalConflicts.value.filter(conflict => conflict.path !== editorStore.currentFile)
    : externalConflicts.value
))

const activeTabModel = computed({
  get: () => editorStore.activeTabId || '',
  set: (id: string) => { if (id) editorStore.switchTab(id) }
})

const closeMobileSidebar = () => {
  mobileSidebarOpen.value = false
}

type MobileReadableViewMode = ViewMode

const preferReadableMobileView = (
  mode: MobileReadableViewMode = 'source',
  options: { force?: boolean } = {}
) => {
  if (!isNarrowViewport.value || editorStore.openTabs.length === 0) return
  if (options.force || editorStore.viewMode === 'live-preview') {
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
const toggleGraphPane = () => settingsStore.toggleGraphPane()
const toggleRightDock = () => settingsStore.toggleRightDock()
const toggleAIPanel = () => settingsStore.toggleAIPanel()

const cycleViewMode = () => {
  const modes: ViewMode[] = ['source', 'live-preview', 'preview']
  const idx = modes.indexOf(editorStore.viewMode)
  editorStore.setViewMode(modes[(idx + 1) % modes.length])
}

const viewModeTooltip = computed(() => {
  const map: Record<string, string> = { source: '源码模式', 'live-preview': '实时预览', preview: '阅读模式' }
  return map[editorStore.viewMode] || '切换视图'
})

const viewModeLabel = computed(() => {
  const map: Record<string, string> = { source: '源码', 'live-preview': '实时预览', preview: '阅读' }
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
const handlePropertiesContentChange = (content: string) => {
  editorStore.setContent(content)
}
const handleToggleLivePreview = () => {
  if (editorStore.viewMode === 'source') {
    editorStore.setViewMode('live-preview')
  } else if (editorStore.viewMode === 'live-preview') {
    editorStore.setViewMode('source')
  } else if (editorStore.viewMode === 'preview') {
    editorStore.setViewMode('live-preview')
  }
}
const handleCursorChange = (line: number) => editorStore.setCursor(line, 0)
const handleSelectionChange = (text: string) => { selectedText.value = text }
const refreshMarkdownPaths = async () => {
  try {
    markdownPaths.value = (await vaultService.getAllMarkdownFiles()).map(file => file.path)
  } catch {
    markdownPaths.value = []
  }
}
const readMarkdownFileForCompletion = async (path: string): Promise<string> => {
  const openTab = editorStore.openTabs.find(tab => tab.filePath === path)
  if (openTab) return openTab.content
  return vaultService.readFile(path)
}
const clearExternalConflict = (path: string) => {
  externalConflicts.value = externalConflicts.value.filter(item => item.path !== path)
}
const markExternalConflict = (
  path: string,
  localContent: string,
  diskContent: string,
  diskState: ExternalConflictDiskState = 'changed'
) => {
  const record: ExternalConflictRecord = {
    path,
    localContent,
    diskContent,
    diskState,
    changedAt: Date.now(),
  }
  const index = externalConflicts.value.findIndex(item => item.path === path)
  if (index === -1) {
    externalConflicts.value = [...externalConflicts.value, record]
    return
  }
  externalConflicts.value = externalConflicts.value.map((item, itemIndex) => itemIndex === index ? record : item)
}
const changeTouchesFile = (event: VaultChangeEvent | undefined, filePath: string): boolean => {
  const changedPath = event?.path
  if (!changedPath || changedPath === '/workspace') return true
  return filePath === changedPath ||
    filePath.startsWith(`${changedPath}/`) ||
    changedPath.startsWith(`${filePath}/`)
}

function splitConflictLines(content: string): string[] {
  return content.split(/\r?\n/)
}

function countContentLines(content: string): number {
  if (!content) return 0
  return splitConflictLines(content).length
}

function countChangedLines(conflict: ExternalConflictRecord): { local: number; disk: number } {
  const localLines = splitConflictLines(conflict.localContent)
  const diskLines = splitConflictLines(conflict.diskContent)
  const maxLines = Math.max(localLines.length, diskLines.length)
  let local = 0
  let disk = 0
  for (let index = 0; index < maxLines; index += 1) {
    if ((localLines[index] ?? '') === (diskLines[index] ?? '')) continue
    if (localLines[index] !== undefined) local += 1
    if (diskLines[index] !== undefined) disk += 1
  }
  return { local, disk }
}

function formatConflictFileName(path: string): string {
  return path.split('/').pop() || path
}

function formatExternalConflictOverviewMessage(): string {
  return `${externalConflicts.value.length} 个文件存在外部冲突，本地未保存内容已保留。`
}

function formatExternalConflictMessage(conflict: ExternalConflictRecord): string {
  if (conflict.diskState === 'missing') {
    return '磁盘上的文件已被删除，本地未保存内容已保留。保存会重新创建该文件。'
  }
  if (conflict.diskState === 'unreadable') {
    return '磁盘版本暂时无法读取，本地未保存内容已保留。'
  }
  return '磁盘上的文件已更新，本地未保存内容已保留。'
}

function formatExternalConflictSummary(conflict: ExternalConflictRecord): string {
  const changedTime = new Date(conflict.changedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (conflict.diskState === 'missing') {
    return `删除预览：磁盘文件缺失，本地 ${countContentLines(conflict.localContent)} 行已保留 · ${changedTime}`
  }
  if (conflict.diskState === 'unreadable') {
    return `读取失败：暂时无法生成磁盘差异，本地 ${countContentLines(conflict.localContent)} 行已保留 · ${changedTime}`
  }
  const stats = countChangedLines(conflict)
  return `差异预览：本地 ${stats.local} 行，磁盘 ${stats.disk} 行不同 · ${changedTime}`
}

function buildUnavailableExternalConflictPreview(
  conflict: ExternalConflictRecord,
  diskMessage: string,
  maxRows: number
): ExternalConflictPreviewLine[] {
  const preview: ExternalConflictPreviewLine[] = [{ type: 'disk', lineNumber: 0, content: diskMessage }]
  const localLines = splitConflictLines(conflict.localContent)
  for (let index = 0; index < localLines.length && preview.length < maxRows; index += 1) {
    preview.push({ type: 'local', lineNumber: index + 1, content: localLines[index] })
  }
  return preview
}

function buildExternalConflictPreview(conflict: ExternalConflictRecord, maxRows = 8): ExternalConflictPreviewLine[] {
  if (conflict.diskState === 'missing') {
    return buildUnavailableExternalConflictPreview(conflict, '磁盘文件缺失', maxRows)
  }
  if (conflict.diskState === 'unreadable') {
    return buildUnavailableExternalConflictPreview(conflict, '磁盘版本暂时不可读取', maxRows)
  }

  const localLines = splitConflictLines(conflict.localContent)
  const diskLines = splitConflictLines(conflict.diskContent)
  const maxLines = Math.max(localLines.length, diskLines.length)
  const preview: ExternalConflictPreviewLine[] = []

  for (let index = 0; index < maxLines && preview.length < maxRows; index += 1) {
    const localLine = localLines[index]
    const diskLine = diskLines[index]
    if ((localLine ?? '') === (diskLine ?? '')) continue
    if (localLine !== undefined && preview.length < maxRows) {
      preview.push({ type: 'local', lineNumber: index + 1, content: localLine })
    }
    if (diskLine !== undefined && preview.length < maxRows) {
      preview.push({ type: 'disk', lineNumber: index + 1, content: diskLine })
    }
  }

  return preview
}

function formatConflictLineMarker(type: ExternalConflictPreviewLine['type']): string {
  return type === 'local' ? '本地' : '磁盘'
}

function isExternalConflictReloadable(conflict: ExternalConflictRecord): boolean {
  return conflict.diskState === 'changed'
}

async function resolveUnavailableConflictDiskState(
  filePath: string,
  event?: VaultChangeEvent
): Promise<ExternalConflictDiskState> {
  if (event?.reason?.toLowerCase() === 'delete') return 'missing'
  try {
    const files = await vaultService.getAllMarkdownFiles()
    return files.some(file => file.path === filePath) ? 'unreadable' : 'missing'
  } catch {
    return event?.reason?.toLowerCase() === 'rename' ? 'missing' : 'unreadable'
  }
}

const reloadCurrentConflictFromDisk = async () => {
  const path = editorStore.currentFile
  if (!path) return
  try {
    const diskContent = await vaultService.readFile(path)
    const activeTab = editorStore.getActiveTab()
    if (activeTab?.filePath === path) {
      activeTab.content = diskContent
      activeTab.isModified = false
    }
    editorStore.setContentSilent(diskContent)
    editorRef.value?.setContent(diskContent)
    editorStore.setContentSilent(diskContent)
    clearExternalConflict(path)
    ElMessage.success('已重新载入磁盘版本')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    ElMessage.error(`重新载入失败: ${message}`)
  }
}
const keepCurrentConflictLocal = () => {
  const path = editorStore.currentFile
  if (!path) return
  clearExternalConflict(path)
  ElMessage.success('已保留本地未保存内容')
}
const saveCurrentConflictSnapshot = async () => {
  const conflict = currentExternalConflict.value
  if (!conflict) return
  try {
    await versionHistory.saveSnapshot(conflict.path, conflict.localContent, '外部冲突：本地未保存版本')
    ElMessage.success('已保存本地快照')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    ElMessage.error(`保存本地快照失败: ${message}`)
  }
}
const openCurrentConflictVersionHistory = () => {
  if (!currentExternalConflict.value) return
  showVersionHistory.value = true
}
const handleFileSelect = async (
  filePath: string,
  options: { mobileViewMode?: MobileReadableViewMode; forceMobileViewMode?: boolean } = {}
) => {
  await selectFileFromOperations(filePath)
  if (!editorStore.getActiveTab()?.isModified) clearExternalConflict(filePath)
  preferReadableMobileView(options.mobileViewMode, { force: options.forceMobileViewMode })
  await refreshMarkdownPaths()
  closeMobileSidebar()
}
const focusExternalConflict = async (path: string) => {
  const tab = editorStore.openTabs.find(item => item.filePath === path)
  if (!tab) {
    await handleFileSelect(path)
    return
  }

  editorStore.switchTab(tab.id)
  await nextTick()
  editorRef.value?.setContent(tab.content)
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
    const markdownFiles = await vaultService.getAllMarkdownFiles()
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
      await vaultService.writeFile(creatablePath, createWikiLinkInitialContent(target))
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
      ? (parsedTarget.heading.startsWith('^')
          ? findMarkdownBlockLine(headingContent || '', parsedTarget.heading)
          : findMarkdownHeadingLine(headingContent || '', parsedTarget.heading))
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
    const sourceContent = sourceTab?.content ?? await vaultService.readFile(payload.reference.filePath)
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

    await vaultService.writeFile(payload.reference.filePath, updatedContent)
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

const handleAIRAGSourceOpen = async (payload: { path: string; lineNumber?: number }) => {
  try {
    await handleSearchResultSelect({ path: payload.path, lineNumber: payload.lineNumber })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    ElMessage.error(`打开 RAG 来源失败: ${message}`)
  }
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
        await vaultService.writeFile(path, content)
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
    await vaultService.createDirectory('/workspace/Daily')
  } catch {
    await vaultService.readDirectory('/workspace/Daily')
  }
}

const handleOpenDailyNote = async () => {
  try {
    const dateStamp = getLocalDateStamp()
    const path = `/workspace/Daily/${dateStamp}.md`
    let created = false

    await ensureDailyDirectory()
    try {
      await vaultService.readFile(path)
    } catch {
      await vaultService.writeFile(path, createDailyNoteContent(dateStamp))
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
    await sidebar.refreshKnowledgeIndex({ waitForPanels: false })
    ElMessage.success({ message: '知识索引已刷新', duration: 6000 })
  } catch {
    ElMessage.error('刷新知识索引失败')
  }
}

const refreshMigrationAuditReport = async (): Promise<MigrationAuditReport> => {
  await refreshMarkdownPaths()
  const report = await runMigrationAudit()
  migrationAuditReport.value = report
  return report
}

const openMigrationAudit = async () => {
  showMigrationAudit.value = true
  migrationAuditRunning.value = true
  migrationAssetRepairPreview.value = null
  migrationAssetRepairPreviewIssues.value = []
  migrationAssetRepairResult.value = null
  try {
    const report = await refreshMigrationAuditReport()
    if (report.issueCount === 0) {
      ElMessage.success('迁移校验通过')
    } else {
      ElMessage.warning(`发现 ${report.issueCount} 个迁移问题`)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    ElMessage.error(`迁移校验失败: ${message}`)
  } finally {
    migrationAuditRunning.value = false
  }
}

const createMigrationAuditMissingNotes = async () => {
  const report = migrationAuditReport.value
  if (!report || report.summary['missing-note'] === 0) return

  migrationAuditRunning.value = true
  try {
    const result = await createMissingNotesFromAuditReport(report)
    await refreshMarkdownPaths()
    await sidebarRef.value?.refreshTree?.()
    await refreshMigrationAuditReport()
    if (result.created > 0) {
      ElMessage.success(`已创建 ${result.created} 个缺失笔记`)
    } else {
      ElMessage.info('没有可创建的缺失笔记')
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    ElMessage.error(`创建缺失笔记失败: ${message}`)
  } finally {
    migrationAuditRunning.value = false
  }
}

const createMigrationAuditMissingSections = async () => {
  const report = migrationAuditReport.value
  const missingSectionCount = (report?.summary['missing-heading'] ?? 0) + (report?.summary['missing-block'] ?? 0)
  if (!report || missingSectionCount === 0) return

  migrationAuditRunning.value = true
  try {
    const result = await createMissingHeadingsAndBlocksFromAuditReport(report)
    await refreshMarkdownPaths()
    await sidebarRef.value?.refreshTree?.()
    await refreshMigrationAuditReport()
    if (result.created > 0) {
      ElMessage.success(`已补齐 ${result.created} 个标题或块`)
    } else {
      ElMessage.info('没有可补齐的标题或块')
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    ElMessage.error(`补齐标题或块失败: ${message}`)
  } finally {
    migrationAuditRunning.value = false
  }
}

const syncUnmodifiedOpenTabsFromDisk = async (paths: string[]) => {
  for (const path of paths) {
    const tab = editorStore.openTabs.find(item => item.filePath === path)
    if (!tab || tab.isModified) continue

    const updatedContent = await vaultService.readFile(path)
    tab.content = updatedContent
    tab.isModified = false

    if (tab.id === editorStore.activeTabId) {
      editorStore.setContentSilent(updatedContent)
      editorRef.value?.setContent(updatedContent)
    }

    clearExternalConflict(path)
  }
}

const emptyAssetRepairResult = (skipped = 0): MigrationAuditAssetRepairResult => ({
  updated: 0,
  skipped,
  paths: [],
  changes: [],
  snapshots: [],
})

const modifiedOpenPathSet = () => new Set(
  editorStore.openTabs
    .filter(tab => tab.isModified)
    .map(tab => tab.filePath)
)

const splitSafeMigrationAssetIssues = (issues: MigrationAuditIssue[]) => {
  const modifiedPaths = modifiedOpenPathSet()
  const safeIssues = issues.filter(issue => !modifiedPaths.has(issue.sourcePath))
  return {
    safeIssues,
    skippedOpenTabs: issues.length - safeIssues.length,
  }
}

const clearMigrationAuditAssetPreview = () => {
  migrationAssetRepairPreview.value = null
  migrationAssetRepairPreviewIssues.value = []
}

const showAssetRepairCompletionMessage = (result: MigrationAuditAssetRepairResult) => {
  if (result.updated > 0) {
    ElMessage.success(result.skipped > 0
      ? `已修复 ${result.updated} 个附件链接，跳过 ${result.skipped} 个`
      : `已修复 ${result.updated} 个附件链接`)
  } else if (result.skipped > 0) {
    ElMessage.info(`没有可安全修复的附件链接，跳过 ${result.skipped} 个`)
  } else {
    ElMessage.info('没有可安全修复的附件链接')
  }
}

const cancelMigrationAuditAssetRepairPreview = () => {
  clearMigrationAuditAssetPreview()
}

const previewMigrationAuditMissingAssets = async () => {
  const report = migrationAuditReport.value
  if (!report) return

  const repairableIssues = report.issues.filter(issue =>
    issue.type === 'missing-asset' && issue.assetCandidates?.length === 1
  )
  if (repairableIssues.length === 0) return
  clearMigrationAuditAssetPreview()
  migrationAssetRepairResult.value = null

  const { safeIssues, skippedOpenTabs } = splitSafeMigrationAssetIssues(repairableIssues)

  if (safeIssues.length === 0) {
    migrationAssetRepairPreview.value = emptyAssetRepairResult(skippedOpenTabs)
    ElMessage.info(`有 ${skippedOpenTabs} 个附件链接位于未保存标签中，已跳过`)
    return
  }

  migrationAuditRunning.value = true
  try {
    const result = await previewMissingAssetLinksFromAuditReport({
      ...report,
      issues: safeIssues,
    })
    const preview = {
      ...result,
      skipped: skippedOpenTabs + result.skipped,
    }
    migrationAssetRepairPreview.value = preview
    migrationAssetRepairPreviewIssues.value = safeIssues

    if (preview.updated > 0) {
      ElMessage.info(`将修复 ${preview.updated} 个附件链接`)
    } else if (preview.skipped > 0) {
      ElMessage.info(`没有可预览的附件链接，跳过 ${preview.skipped} 个`)
    } else {
      ElMessage.info('没有可预览的附件链接')
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    ElMessage.error(`预览附件修复失败: ${message}`)
  } finally {
    migrationAuditRunning.value = false
  }
}

const previewMigrationAuditMissingAsset = async (issue: MigrationAuditIssue, candidatePath: string) => {
  const report = migrationAuditReport.value
  if (!report || issue.type !== 'missing-asset' || !candidatePath) return
  clearMigrationAuditAssetPreview()
  migrationAssetRepairResult.value = null

  const sourceTab = editorStore.openTabs.find(tab => tab.filePath === issue.sourcePath)
  if (sourceTab?.isModified) {
    migrationAssetRepairPreview.value = emptyAssetRepairResult(1)
    ElMessage.info('该附件链接位于未保存标签中，已跳过')
    return
  }

  migrationAuditRunning.value = true
  try {
    const previewIssue = { ...issue, assetCandidates: [candidatePath] }
    const result = await previewMissingAssetLinksFromAuditReport({
      ...report,
      issues: [previewIssue],
    })
    migrationAssetRepairPreview.value = result
    migrationAssetRepairPreviewIssues.value = [previewIssue]

    if (result.updated > 0) {
      ElMessage.info(`将修复 ${result.updated} 个附件链接`)
    } else if (result.skipped > 0) {
      ElMessage.info(`没有可预览的附件链接，跳过 ${result.skipped} 个`)
    } else {
      ElMessage.info('没有可预览的附件链接')
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    ElMessage.error(`预览附件修复失败: ${message}`)
  } finally {
    migrationAuditRunning.value = false
  }
}

const confirmMigrationAuditAssetRepair = async () => {
  const report = migrationAuditReport.value
  const previewIssues = migrationAssetRepairPreviewIssues.value
  if (!report || previewIssues.length === 0) return

  const { safeIssues, skippedOpenTabs } = splitSafeMigrationAssetIssues(previewIssues)
  if (safeIssues.length === 0) {
    clearMigrationAuditAssetPreview()
    migrationAssetRepairResult.value = emptyAssetRepairResult(skippedOpenTabs)
    ElMessage.info(`有 ${skippedOpenTabs} 个附件链接位于未保存标签中，已跳过`)
    return
  }

  migrationAuditRunning.value = true
  try {
    const result = await repairMissingAssetLinksFromAuditReport({
      ...report,
      issues: safeIssues,
    })
    const repairResult = {
      ...result,
      skipped: skippedOpenTabs + result.skipped,
    }
    await syncUnmodifiedOpenTabsFromDisk(result.paths)
    await refreshMarkdownPaths()
    await sidebarRef.value?.refreshTree?.()
    await refreshMigrationAuditReport()
    clearMigrationAuditAssetPreview()
    migrationAssetRepairResult.value = repairResult
    showAssetRepairCompletionMessage(repairResult)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    ElMessage.error(`修复附件链接失败: ${message}`)
  } finally {
    migrationAuditRunning.value = false
  }
}

const handleMigrationAuditNavigate = (issue: MigrationAuditIssue) => {
  showMigrationAudit.value = false
  void handleSearchResultSelect({ path: issue.sourcePath, lineNumber: issue.lineNumber })
}

const openMigrationAuditAssetRepairHistory = async () => {
  const snapshotPath = migrationAssetRepairResult.value?.snapshots[0]?.sourcePath
  if (!snapshotPath) return
  showMigrationAudit.value = false
  await handleFileSelect(snapshotPath)
  showVersionHistory.value = true
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
    'file.export-html': () => { void exportAsHTML() },
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
    'view.graph-workbench': () => toggleGraphPane(),
    'view.right-dock': () => toggleRightDock(),
    'view.files-panel': () => openSidebarTab('files'),
    'view.knowledge-panel': () => openSidebarTab('graph'),
    'view.ai-settings': () => openSidebarTab('ai'),
    'view.outline': () => openSidebarTab('outline'),
    'view.settings': () => openSidebarTab('settings'),
    'view.source': () => editorStore.setViewMode('source'),
    'view.live-preview': () => editorStore.setViewMode('live-preview'),
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
    'knowledge.migration-audit': () => openMigrationAudit(),
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
  else if (panel === 'graphPane') startSize.w = settingsStore.graphPaneWidth
  else if (panel === 'rightDock') startSize.w = settingsStore.rightDockWidth
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
  } else if (resizing === 'graphPane') {
    const diff = startPos.x - event.clientX
    settingsStore.setGraphPaneWidth(Math.max(320, Math.min(760, startSize.w + diff)))
  } else if (resizing === 'rightDock') {
    const diff = startPos.x - event.clientX
    settingsStore.setRightDockWidth(Math.max(280, Math.min(460, startSize.w + diff)))
  } else if (resizing === 'aiPanel') {
    const diff = startPos.y - event.clientY
    settingsStore.setAIPanelHeight(Math.max(140, Math.min(400, startSize.h + diff)))
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
let unsubscribeVaultChanges: (() => void) | null = null
let unsubscribeEmbedSyncChanges: (() => void) | null = null
let isSyncingVaultChange = false
let hasPendingVaultChange = false

const syncOpenTabsFromVault = async (event?: VaultChangeEvent) => {
  for (const tab of [...editorStore.openTabs]) {
    if (!changeTouchesFile(event, tab.filePath)) continue
    if (tab.isModified) {
      try {
        const latestContent = await vaultService.readFile(tab.filePath)
        if (latestContent !== tab.content) markExternalConflict(tab.filePath, tab.content, latestContent)
        else clearExternalConflict(tab.filePath)
      } catch {
        const diskState = await resolveUnavailableConflictDiskState(tab.filePath, event)
        markExternalConflict(tab.filePath, tab.content, '', diskState)
      }
      continue
    }
    try {
      const latestContent = await vaultService.readFile(tab.filePath)
      tab.content = latestContent
      tab.isModified = false
      clearExternalConflict(tab.filePath)
    } catch {
      editorStore.removeOpenPath(tab.filePath, false)
      clearExternalConflict(tab.filePath)
    }
  }

  const activeTab = editorStore.getActiveTab()
  if (!activeTab) {
    editorStore.setContentSilent('')
    editorRef.value?.setContent('')
    editorStore.setContentSilent('')
    return
  }
  if (!activeTab.isModified) {
    editorStore.setContentSilent(activeTab.content)
    editorRef.value?.setContent(activeTab.content)
    editorStore.setContentSilent(activeTab.content)
  }
}

const syncVaultExternalChanges = async (_event?: VaultChangeEvent) => {
  if (isAppDisposed || vaultService.kind !== 'electron-fs') return
  if (isSyncingVaultChange) {
    hasPendingVaultChange = true
    return
  }

  isSyncingVaultChange = true
  try {
    do {
      const eventForSync = hasPendingVaultChange ? undefined : _event
      hasPendingVaultChange = false
      await vaultService.refreshFromDisk().catch(() => {})
      await refreshMarkdownPaths().catch(() => {})
      await (sidebarRef.value?.refreshTree?.() ?? Promise.resolve()).catch(() => {})
      await syncOpenTabsFromVault(eventForSync).catch(() => {})
      embedSyncService.notifyChange(eventForSync?.path || '/workspace')
    } while (hasPendingVaultChange && !isAppDisposed)
  } catch {
    // External filesystem changes can be partial while sync tools are writing.
  } finally {
    isSyncingVaultChange = false
  }
}

onMounted(async () => {
  configureAIProvider(settingsStore.aiConfig)
  settingsStore.applyTheme()
  updateViewportWidth()
  window.addEventListener('resize', updateViewportWidth)
  window.addEventListener('beforeunload', handleBeforeUnload)
  document.addEventListener('keydown', handleKeyDown)
  unsubscribeVaultChanges = vaultService.onDidChange((event) => {
    void syncVaultExternalChanges(event)
  })
  unsubscribeEmbedSyncChanges = embedSyncService.onDidChange((event) => {
    if (editorStore.currentFile && event.affectedHostPaths.includes(editorStore.currentFile)) {
      embedRefreshKey.value += 1
    }
  })
  try {
    await vaultService.init()
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

watch(() => [editorStore.currentFile, editorStore.isModified] as const, ([filePath, isModified]) => {
  if (filePath && !isModified) clearExternalConflict(filePath)
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
  unsubscribeVaultChanges?.()
  unsubscribeVaultChanges = null
  unsubscribeEmbedSyncChanges?.()
  unsubscribeEmbedSyncChanges = null
  embedSyncService.clear()
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
