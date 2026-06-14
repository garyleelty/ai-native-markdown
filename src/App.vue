<template>
  <el-container class="app-container" :class="{ 'focus-mode-active': focusMode }" @dragenter="dragDrop.handleDragEnter" @dragleave="dragDrop.handleDragLeave" @dragover="dragDrop.handleDragOver" @drop="dragDrop.handleDrop">
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
      v-model="migrationAudit.showMigrationAudit.value"
      :report="migrationAudit.migrationAuditReport.value"
      :running="migrationAudit.migrationAuditRunning.value"
      :asset-repair-preview="migrationAudit.migrationAssetRepairPreview.value"
      :asset-repair-result="migrationAudit.migrationAssetRepairResult.value"
      @rerun="migrationAudit.openMigrationAudit"
      @create-missing-notes="migrationAudit.createMigrationAuditMissingNotes"
      @create-missing-sections="migrationAudit.createMigrationAuditMissingSections"
      @preview-missing-assets="migrationAudit.previewMigrationAuditMissingAssets"
      @preview-missing-asset="migrationAudit.previewMigrationAuditMissingAsset"
      @confirm-asset-repair="migrationAudit.confirmMigrationAuditAssetRepair"
      @cancel-asset-repair-preview="migrationAudit.cancelMigrationAuditAssetRepairPreview"
      @open-asset-repair-history="migrationAudit.openMigrationAuditAssetRepairHistory"
      @navigate="migrationAudit.handleMigrationAuditNavigate"
    />
    <FocusMode :active="focusMode" :file-name="currentFileName" :word-count="wordCount" @exit="focusMode = false" />
    <el-header class="app-header" height="44px">
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
        <el-tooltip v-if="editorStore.currentFile" :content="editorStore.currentFile" placement="bottom">
          <el-tag effect="plain" round>
            {{ editorStore.currentFile.split('/').pop() }}
          </el-tag>
        </el-tooltip>
      </div>
      <div class="header-right">
        <!-- AI 助手 - 高频入口 -->
        <el-tooltip content="AI 助手" placement="bottom">
          <span class="ai-btn-wrapper">
            <el-button :icon="ChatDotRound" native-type="button" circle size="small" aria-label="AI 助手" :type="settingsStore.showAIPanel ? 'primary' : 'default'" @click="toggleAIPanel" />
            <span v-if="settingsStore.aiConfigured" class="ai-status-dot" :class="headerAIState" />
          </span>
        </el-tooltip>

        <!-- 视图切换 -->
        <el-dropdown trigger="click" hide-on-click @command="handleViewDropdown">
          <el-button
            :icon="viewModeIcon"
            native-type="button"
            circle
            size="small"
            aria-label="切换视图模式"
            :title="viewModeTooltip"
            @click="handleViewModeTriggerClick"
          />
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="source" :icon="EditPen" :class="{ 'is-active': editorStore.viewMode === 'source' }">源码模式</el-dropdown-item>
              <el-dropdown-item command="live" :icon="View" :class="{ 'is-active': editorStore.viewMode === 'live-preview' }">实时预览</el-dropdown-item>
              <el-dropdown-item command="split" :icon="Grid" :class="{ 'is-active': editorStore.viewMode === 'split' }">分屏模式</el-dropdown-item>
              <el-dropdown-item command="preview" :icon="View" :class="{ 'is-active': editorStore.viewMode === 'preview' }">阅读模式</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>

        <!-- 更多菜单（低频功能聚合） -->
        <el-dropdown trigger="click" hide-on-click @command="handleMoreMenu">
          <el-button
            :icon="MoreFilled"
            native-type="button"
            circle
            size="small"
            aria-label="更多功能"
            title="更多"
          />
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="graph" :icon="Share" :class="{ 'is-active': showDesktopGraphPane }">图谱工作区</el-dropdown-item>
              <el-dropdown-item command="dock" :icon="Tickets" :class="{ 'is-active': showDesktopRightDock }">右侧工作台</el-dropdown-item>
              <el-dropdown-item command="focus" :icon="FullScreen" :class="{ 'is-active': focusMode }">专注模式 (F11)</el-dropdown-item>
              <el-dropdown-item command="history" :icon="Clock">版本历史 (Ctrl+Shift+H)</el-dropdown-item>
              <el-dropdown-item command="palette" :icon="Promotion">命令面板 (Ctrl+P)</el-dropdown-item>
              <el-dropdown-item divided command="export" :icon="Download">导出...</el-dropdown-item>
              <el-dropdown-item command="cheatsheet" :icon="Document">Markdown 速查表</el-dropdown-item>
              <el-dropdown-item command="theme" :icon="isDark ? Moon : Sunny">{{ isDark ? '浅色模式' : '深色模式' }}</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
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
        :class="{ 'is-mobile': isNarrowViewport, 'is-mobile-open': isNarrowViewport && mobileSidebarOpen, 'is-collapsed': !sidebarVisible }"
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
          @insert="text => handleInsertText(text)"
        />
        <div v-if="sidebarVisible && !isNarrowViewport" class="resize-handle-v" @mousedown="startResize('sidebar', $event)" />
      </el-aside>

      <el-container class="editor-container-main" direction="Vertical">
        <el-main class="editor-main">
          <div v-if="editorStore.openTabs.length > 0" class="tabs-bar" role="tablist">
            <el-tabs
              v-model="activeTabModel"
              type="card"
              closable
              @tab-remove="handleCloseTab"
              @tab-change="handleTabChange"
            >
              <el-tab-pane
                v-for="(tab, index) in editorStore.openTabs"
                :key="tab.id"
                :label="tab.fileName"
                :name="tab.id"
                :draggable="true"
                :index="String(index)"
                :closable="true"
                @dragstart="(e: DragEvent) => handleTabDragStart(e, index)"
                @drop="(e: DragEvent) => handleTabDrop(e, String(index))"
                @contextmenu.prevent="showTabContextMenu($event, tab.id)"
              >
                <template #label>
                  <span class="tab-label" :class="{ modified: tab.isModified }" :title="tab.filePath">
                    <span v-if="tab.isModified" class="tab-modified-dot" />
                    {{ tab.fileName }}
                  </span>
                </template>
              </el-tab-pane>
            </el-tabs>
            <TabContextMenu
              :visible="tabContextMenuVisible"
              :position="tabContextMenuPosition"
              :disable-close="editorStore.openTabs.length <= 1"
              @close="hideTabContextMenu"
              @command="handleTabContextCommand"
            />
          </div>

          <WelcomePage
            v-if="editorStore.openTabs.length === 0"
            @new-file="handleNewFileFromWelcome"
            @open-folder="handleOpenFolderFromWelcome"
            @demo="handleDemoFromWelcome"
            @open-file="handleFileSelect"
          />
          <div v-else class="editor-workspace">
            <VaultConflictOverlay
              :external-conflicts="externalConflicts"
              :current-external-conflict="currentExternalConflict"
              :other-external-conflicts="otherExternalConflicts"
              :conflict-handler="conflictHandler"
              @focus-conflict="focusExternalConflict"
              @show-version-history="showVersionHistory = true"
            />
            <div class="editor-preview-view">
              <div v-if="editorStore.viewMode === 'split'" class="split-view">
                <div class="split-pane split-editor" :style="{ width: (settingsStore.splitRatio * 100) + '%' }">
                  <Editor
                    ref="editorRef"
                    v-model="editorContent"
                    :current-file="editorStore.currentFile"
                    :markdown-paths="markdownPaths"
                    :read-markdown-file="readMarkdownFileForCompletion"
                    :embed-refresh-key="embedRefreshKey"
                    :live-preview="false"
                    @update="handleEditorUpdate"
                    @cursor-change="handleCursorChange"
                    @selection-change="handleSelectionChange"
                    @embed-navigate="handleWikiNavigate"
                    @toggle-live-preview="handleToggleLivePreview"
                    @save="saveCurrentFile"
                    class="editor-pane"
                  />
                </div>
                <div class="split-divider-handle" @mousedown="startResize('splitDivider', $event)" />
                <div class="split-pane split-preview" :style="{ width: ((1 - settingsStore.splitRatio) * 100) + '%' }">
                  <Preview
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
              <Editor
                v-else-if="editorStore.viewMode !== 'preview'"
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
                @save="saveCurrentFile"
                class="editor-pane"
              />
              <Preview
                v-else-if="editorStore.viewMode === 'preview'"
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

      </el-container>

      <Transition name="workbench-pane">
        <div
          v-if="settingsStore.showAIPanel && !isNarrowViewport"
          class="ai-panel-shell"
          :style="{ width: settingsStore.aiPanelWidth + 'px' }"
        >
          <div class="workbench-resize-handle is-left" @mousedown="startResize('aiPanel', $event)" />
          <ChatPanel
            ref="chatPanelRef"
            :context="selectedText || editorContent.slice(0, 2000)"
            :current-file="editorStore.currentFile"
            @insert="handleInsertText"
            @open-source="handleAIRAGSourceOpen"
            @navigate="handleFileSelect"
          />
        </div>
      </Transition>

      <!-- Mobile AI panel: bottom sheet -->
      <Transition name="ai-slide">
        <div v-if="settingsStore.showAIPanel && isNarrowViewport" class="ai-panel-section" :style="{ height: settingsStore.aiPanelHeight + 'px' }">
          <div class="resize-handle-h" @mousedown="startResize('aiPanel', $event)" />
          <ChatPanel
            :context="selectedText || editorContent.slice(0, 2000)"
            :current-file="editorStore.currentFile"
            @insert="handleInsertText"
            @open-source="handleAIRAGSourceOpen"
            @navigate="handleFileSelect"
          />
        </div>
      </Transition>

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
      <span class="status-item status-view-mode">
        <el-tag size="small" :type="viewModeTagType" effect="plain" disable-transitions>{{ viewModeLabel }}</el-tag>
      </span>
      <span class="status-item status-line" v-if="editorStore.cursorLine > 0">行 {{ editorStore.cursorLine }}, 列 {{ editorStore.cursorColumn }}</span>
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
      <DocumentStats :content="editorContent">
        <span class="status-item status-clickable status-stats">{{ wordCount }} 词 · {{ editorContent.length }} 字符</span>
      </DocumentStats>
      <span class="status-item status-duration" v-if="sessionDuration">{{ sessionDuration }}</span>
      <span class="status-item ai-indicator" v-if="settingsStore.showAIPanel" title="AI 已启用" />
      <WritingGoal :current="wordCount" />
    </el-footer>
    <Transition name="fade">
      <div v-if="isDragging" class="drag-overlay">
        <div class="drag-content">
          <el-icon :size="48" color="var(--el-color-primary)"><Upload /></el-icon>
          <p>拖放文件到此处</p>
          <p class="drag-hint">支持 Markdown、图片、PDF</p>
        </div>
      </div>
    </Transition>
  </el-container>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted, watch, defineAsyncComponent } from 'vue'
import { ElMessage } from 'element-plus'
import { Operation, Document, ChatDotRound, View, EditPen, Download, Moon, Sunny, Clock, Upload, FullScreen, Share, Tickets, MoreFilled, Promotion, Grid } from '@element-plus/icons-vue'
import { useSettingsStore } from './stores/settings'
import { useEditorStore } from './stores/editor'
import { aiService, configureAIProvider } from './services/ai'
import { vaultService } from './services/vault'
import { embedSyncService } from './services/embedSyncService'
import type { KnowledgeReference } from './services/knowledgeIndex'
import { useFileOperations } from './composables/useFileOperations'
import { useExport } from './composables/useExport'
import { useConflictHandler } from './composables/useConflictHandler'
import { useMigrationAudit } from './composables/useMigrationAudit'
import { useResize } from './composables/useResize'
import { useDragDrop } from './composables/useDragDrop'
import { useWikiNavigation } from './composables/useWikiNavigation'
import { useDailyNote } from './composables/useDailyNote'
import { useAppCommands } from './composables/useAppCommands'
import { useViewMode } from './composables/useViewMode'
import { useVaultSync } from './composables/useVaultSync'
import { useTabManagement } from './composables/useTabManagement'
import { useAppKeyboard } from './composables/useAppKeyboard'
import { useAIStatus } from './composables/useAIStatus'
import type { ViewMode, FileTreeRenamePayload } from './types'
import './styles/app.css'
import VaultConflictOverlay from './components/VaultConflictOverlay.vue'
import Sidebar from './components/Sidebar.vue'
import Editor from './components/Editor.vue'
import Preview from './components/Preview.vue'
import ChatPanel from './components/ai-panel/ChatPanel.vue'
import GraphWorkbenchPane from './components/workbench/GraphWorkbenchPane.vue'
import RightDock from './components/workbench/RightDock.vue'
import TabContextMenu from './components/workbench/TabContextMenu.vue'
import CommandPalette from './components/CommandPalette.vue'
import MigrationAuditDialog from './components/MigrationAuditDialog.vue'
import WelcomePage from './components/WelcomePage.vue'
import DocumentStats from './components/editor/DocumentStats.vue'
import FocusMode from './components/editor/FocusMode.vue'
import WritingGoal from './components/editor/WritingGoal.vue'
import { updateWikiLinksForRename } from './utils/wikiLinks'
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

const { aiPanelState: headerAIState } = useAIStatus()

const editorRef = ref()
const previewRef = ref()
const chatPanelRef = ref<{ clearMessages?: () => void } | null>(null)
const sidebarRef = ref()
const selectedText = ref('')
const showCommandPalette = ref(false)
const showTemplateGallery = ref(false)
const showVersionHistory = ref(false)
const focusMode = ref(false)
const showExportDialog = ref(false)
const showCheatsheet = ref(false)
const sessionDuration = ref('')
const markdownPaths = ref<string[]>([])
const embedRefreshKey = ref(0)
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

const editorContent = computed({
  get: () => editorStore.content,
  set: (value: string) => editorStore.setContent(value)
})

const isDark = computed(() => settingsStore.isDark)
const isNarrowViewport = computed(() => viewportWidth.value <= narrowViewportBreakpoint)

const {
  viewModeTooltip,
  viewModeIcon,
  viewModeLabel,
  viewModeTagType,
  handleViewDropdown,
  handleViewModeTriggerClick,
  handleToggleLivePreview,
  preferReadableMobileView,
} = useViewMode({
  editorStore: () => editorStore,
  isNarrowViewport: () => isNarrowViewport.value,
  focusMode: () => focusMode.value,
})

const sidebarVisible = computed(() => isNarrowViewport.value ? mobileSidebarOpen.value : settingsStore.showSidebar)
const isPrimaryFileWorkspaceVisible = computed(() => !sidebarVisible.value || settingsStore.activeSidebarTab === 'files')
const showDesktopGraphPane = computed(() => (
  !isNarrowViewport.value &&
  viewportWidth.value >= 1040 &&
  settingsStore.showGraphPane &&
  editorStore.openTabs.length > 0 &&
  isPrimaryFileWorkspaceVisible.value
))
const showDesktopRightDock = computed(() => (
  !isNarrowViewport.value &&
  viewportWidth.value >= 1040 &&
  settingsStore.showRightDock &&
  editorStore.openTabs.length > 0 &&
  isPrimaryFileWorkspaceVisible.value &&
  (!showDesktopGraphPane.value || viewportWidth.value >= 1500)
))
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

// ── Forwarded composable state (initialized later, after function declarations) ──

// ── Helper functions (kept inline — too small/tightly coupled to extract) ──

const closeMobileSidebar = () => {
  mobileSidebarOpen.value = false
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
const revealPrimaryFileWorkspace = () => {
  if (!isNarrowViewport.value && sidebarVisible.value && settingsStore.activeSidebarTab !== 'files') {
    settingsStore.setActiveTab('files')
  }
}

const toggleGraphPane = () => {
  if (isNarrowViewport.value) {
    settingsStore.toggleGraphPane()
    return
  }
  if (showDesktopGraphPane.value) {
    settingsStore.setGraphPaneVisible(false)
    return
  }
  revealPrimaryFileWorkspace()
  settingsStore.setGraphPaneVisible(true)
  if (viewportWidth.value < 1500) settingsStore.setRightDockVisible(false)
}

const toggleRightDock = () => {
  if (isNarrowViewport.value) {
    settingsStore.toggleRightDock()
    return
  }
  if (showDesktopRightDock.value) {
    settingsStore.setRightDockVisible(false)
    return
  }
  revealPrimaryFileWorkspace()
  settingsStore.setRightDockVisible(true)
  if (viewportWidth.value < 1500) settingsStore.setGraphPaneVisible(false)
}
const toggleAIPanel = () => settingsStore.toggleAIPanel()

const handleMoreMenu = (command: string) => {
  switch (command) {
    case 'graph':
      toggleGraphPane()
      break
    case 'dock':
      toggleRightDock()
      break
    case 'focus':
      focusMode.value = !focusMode.value
      break
    case 'history':
      showVersionHistory.value = true
      break
    case 'palette':
      showCommandPalette.value = true
      break
    case 'export':
      showExportDialog.value = true
      break
    case 'cheatsheet':
      showCheatsheet.value = true
      break
    case 'theme':
      toggleTheme()
      break
  }
}

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

const handleFileSelect = async (
  filePath: string,
  options: { mobileViewMode?: ViewMode; forceMobileViewMode?: boolean } = {}
) => {
  await selectFileFromOperations(filePath)
  if (!editorStore.getActiveTab()?.isModified) conflictHandler.clearExternalConflict(filePath)
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

// ── Composables (must be after function declarations they reference) ──

const conflictHandler = useConflictHandler({
  editorRef: () => editorRef.value,
})

const migrationAudit = useMigrationAudit({
  refreshMarkdownPaths,
  sidebarRef: () => sidebarRef.value,
  editorRef: () => editorRef.value,
  syncOpenTabsFromVault: conflictHandler.syncOpenTabsFromVault,
  showVersionHistory: () => { showVersionHistory.value = true },
  handleFileSelect,
  handleSearchResultSelect,
})

const { startResize, stopResize } = useResize({
  isNarrowViewport: () => isNarrowViewport.value,
})

const dragDrop = useDragDrop({
  editorRef: () => editorRef.value,
  preferReadableMobileView,
  refreshMarkdownPaths,
})

// ── Forwarded composable state ──

const externalConflicts = conflictHandler.externalConflicts
const currentExternalConflict = computed(() => conflictHandler.currentExternalConflict())
const otherExternalConflicts = computed(() => conflictHandler.otherExternalConflicts())
const isDragging = dragDrop.isDragging
const handleOutlineNavigate = async (lineNumber: number) => {
  editorStore.setCursor(lineNumber, 0)
  await nextTick()
  if (editorRef.value) editorRef.value.scrollToLine?.(lineNumber)
  if (previewRef.value) previewRef.value.scrollToLine?.(lineNumber)
}

const { handleWikiNavigate, handleKnowledgeReferenceSelect, handleLinkMention } = useWikiNavigation({
  editorStore: () => editorStore,
  editorContent: () => editorContent.value,
  markdownPaths: () => markdownPaths,
  sidebarRef: () => sidebarRef.value,
  editorRef: () => editorRef.value,
  handleFileSelect,
  handleOutlineNavigate,
  refreshMarkdownPaths,
})

const { openDailyNote } = useDailyNote({
  sidebarRef: () => sidebarRef.value,
  handleFileSelect,
  refreshMarkdownPaths,
})

const { handleCommandExecute } = useAppCommands({
  editorStore,
  settingsStore,
  sidebarRef: () => sidebarRef.value,
  editorRef: () => editorRef.value,
  chatPanelRef: () => chatPanelRef.value,
  showCommandPalette: () => showCommandPalette,
  showTemplateGallery: () => showTemplateGallery,
  showVersionHistory: () => showVersionHistory,
  showExportDialog: () => showExportDialog,
  showCheatsheet: () => showCheatsheet,
  focusMode: () => focusMode,
  handleFileSelect,
  refreshMarkdownPaths,
  saveCurrentFile,
  exportAsMarkdown,
  exportAsHTML,
  toggleSidebar,
  toggleAIPanel,
  toggleGraphPane,
  toggleRightDock,
  toggleTheme,
  ensureMobileSidebar,
  openDailyNote,
  migrationAudit,
})
const handleInsertText = (text: string) => {
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

const {
  tabContextMenuVisible,
  tabContextMenuTargetId,
  tabContextMenuPosition,
  tabDragFromIndex,
  handleTabDragStart,
  handleTabDrop,
  showTabContextMenu,
  hideTabContextMenu,
  handleTabContextCommand,
} = useTabManagement({
  editorStore: () => editorStore,
  saveCurrentFile,
  handleCloseTab,
  editorRef: () => editorRef.value,
})

const { handleKeyDown } = useAppKeyboard({
  editorRef: () => editorRef.value,
  settingsStore,
  editorStore,
  handleSaveKeyDown,
  showVersionHistory,
  showCommandPalette,
  focusMode,
  mobileSidebarOpen,
  sidebarVisible: () => sidebarVisible.value,
  closeMobileSidebar,
  toggleSidebar,
})

const updateViewportWidth = () => {
  viewportWidth.value = window.innerWidth
  if (!isNarrowViewport.value) closeMobileSidebar()
}

let sessionTimer: ReturnType<typeof setInterval> | null = null
const isAppDisposed = ref(false)
let unsubscribeVaultChanges: (() => void) | null = null
let unsubscribeEmbedSyncChanges: (() => void) | null = null

const { syncVaultExternalChanges } = useVaultSync({
  editorStore,
  sidebarRef: () => sidebarRef.value,
  refreshMarkdownPaths,
  syncOpenTabsFromVault: conflictHandler.syncOpenTabsFromVault,
  embedRefreshKey,
  isAppDisposed,
})

onMounted(async () => {
  await settingsStore.decryptAndApplyAIConfig()
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
    if (isAppDisposed.value) return
    const restoredContent = await editorStore.hydrateRestoredSession()
    if (isAppDisposed.value) return
    if (editorRef.value) {
      editorRef.value.setContent(restoredContent)
    }
    preferReadableMobileView()
    await refreshMarkdownPaths()
  } catch {
    if (!isAppDisposed.value) editorStore.setContentSilent('')
  }

  if (isAppDisposed.value) return
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
  if (filePath && !isModified) conflictHandler.clearExternalConflict(filePath)
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

// 标签切换时自动滚动到活动标签
watch(() => editorStore.activeTabId, () => {
  nextTick(() => {
    const activeTab = document.querySelector('.tabs-bar .el-tabs__item.is-active') as HTMLElement | null
    if (activeTab) {
      activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }
  })
})

onUnmounted(() => {
  isAppDisposed.value = true
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
