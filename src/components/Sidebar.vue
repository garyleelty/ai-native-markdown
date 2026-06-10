<template>
  <div class="sidebar">
    <el-menu
      :default-active="activeTab"
      class="sidebar-nav"
      @select="handleNavSelect"
    >
      <el-menu-item index="files" aria-label="文件管理">
        <el-icon><Folder /></el-icon>
      </el-menu-item>
      <el-menu-item index="graph" aria-label="知识">
        <el-icon><Share /></el-icon>
      </el-menu-item>
      <el-menu-item index="rss" aria-label="RSS 订阅">
        <el-icon><Document /></el-icon>
      </el-menu-item>
    </el-menu>

    <div class="sidebar-content">
      <Transition name="fade" mode="out-in">
        <FileExplorer
          v-if="activeTab === 'files'"
          ref="fileExplorerRef"
          @select="(path: string) => emit('select', path)"
          @search-result-select="payload => emit('search-result-select', payload)"
          @root-path-change="handleRootPathChange"
          @renamed="payload => emit('renamed', payload)"
          @deleted="payload => emit('deleted', payload)"
        />
        <KnowledgePanel
          v-else-if="activeTab === 'graph'"
          ref="knowledgePanelRef"
          :root-path="rootPath"
          :current-file="currentFile"
          :content="editorContent"
          :cursor-line="cursorLine"
          @select="(path: string) => emit('select', path)"
          @reference-select="reference => emit('reference-select', reference)"
          @wiki-navigate="target => emit('wiki-navigate', target)"
          @link-mention="payload => emit('link-mention', payload)"
          @navigate="lineNumber => emit('navigate', lineNumber)"
        />
        <RSSPanel
          v-else-if="activeTab === 'rss'"
          @select="(path: string) => emit('select', path)"
        />
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { Folder, Share, Document } from '@element-plus/icons-vue'
import FileExplorer from './sidebar/FileExplorer.vue'
import KnowledgePanel from './sidebar/KnowledgePanel.vue'
import RSSPanel from './sidebar/RSSPanel.vue'
import { useSettingsStore } from '@/stores/settings'
import type { SidebarTab } from '@/types'
import type { KnowledgeReference } from '@/services/knowledgeIndex'

interface Props {
  currentFile?: string
  editorContent?: string
  cursorLine?: number
}
withDefaults(defineProps<Props>(), { currentFile: '', editorContent: '', cursorLine: 0 })

const emit = defineEmits<{
  (e: 'select', path: string): void
  (e: 'search-result-select', payload: { path: string; lineNumber?: number }): void
  (e: 'reference-select', reference: KnowledgeReference): void
  (e: 'wiki-navigate', target: string): void
  (e: 'link-mention', payload: { reference: KnowledgeReference; targetTitle: string; targetNames: string[] }): void
  (e: 'navigate', lineNumber: number): void
  (e: 'renamed', payload: { oldPath: string; newPath: string; isDirectory: boolean; renamedPaths?: Array<{ oldPath: string; newPath: string; isDirectory: boolean }>; updatedLinkPaths?: string[] }): void
  (e: 'deleted', payload: { path: string; isDirectory: boolean }): void
}>()

// 精简后的侧边栏 tabs
const sidebarTabs = new Set<SidebarTab>(['files', 'graph', 'rss'])
const settingsStore = useSettingsStore()
const activeTab = computed(() => settingsStore.activeSidebarTab)
const rootPath = ref('')
const fileExplorerRef = ref()
const knowledgePanelRef = ref<{ refreshIndex?: (options?: { notify?: boolean; waitForPanels?: boolean }) => Promise<void> } | null>(null)

const handleNavSelect = (index: string) => {
  if (sidebarTabs.has(index as SidebarTab)) {
    settingsStore.setActiveTab(index as SidebarTab)
  }
}

const handleRootPathChange = (path: string) => {
  rootPath.value = path
}

const readFile = async (filePath: string): Promise<string> => {
  return fileExplorerRef.value?.readFile?.(filePath) ?? ''
}

const saveFile = async (filePath: string, content: string): Promise<boolean> => {
  return fileExplorerRef.value?.saveFile?.(filePath, content) ?? false
}

const openTab = (tab: SidebarTab) => {
  if (sidebarTabs.has(tab)) settingsStore.setActiveTab(tab)
}

const waitForFileExplorer = async () => {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await nextTick()
    if (fileExplorerRef.value) return fileExplorerRef.value
    await new Promise(resolve => window.setTimeout(resolve, 50))
  }
  return fileExplorerRef.value
}

const waitForKnowledgePanel = async () => {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await nextTick()
    if (knowledgePanelRef.value) return knowledgePanelRef.value
    await new Promise(resolve => window.setTimeout(resolve, 50))
  }
  return knowledgePanelRef.value
}

const refreshKnowledgeIndex = async (options: { waitForPanels?: boolean } = {}) => {
  openTab('graph')
  const panel = await waitForKnowledgePanel()
  if (!panel?.refreshIndex) {
    throw new Error('知识面板未就绪')
  }
  await panel.refreshIndex({ notify: false, waitForPanels: options.waitForPanels })
}

const focusFileSearch = async (mode: 'name' | 'content', query = '') => {
  openTab('files')
  const explorer = await waitForFileExplorer()
  await explorer?.focusSearch?.(mode, query)
}

const refreshTree = async () => {
  openTab('files')
  const explorer = await waitForFileExplorer()
  await explorer?.refreshTree?.()
}

const handleCreateFile = () => fileExplorerRef.value?.handleCreateFile?.()
const handleCreateFolder = () => fileExplorerRef.value?.handleCreateFolder?.()
const openFolder = () => fileExplorerRef.value?.openFolder?.()
const initDemoWorkspace = () => fileExplorerRef.value?.initDemoWorkspace?.()

defineExpose({
  readFile,
  saveFile,
  handleCreateFile,
  handleCreateFolder,
  openFolder,
  initDemoWorkspace,
  openTab,
  refreshTree,
  refreshKnowledgeIndex,
  focusFileSearch,
})
</script>

<style scoped>
.sidebar {
  height: 100%;
  display: flex;
  overflow: hidden;
  background: var(--obsidian-bg-secondary, #252525);
}

.sidebar-nav {
  width: 44px;
  flex-shrink: 0;
  border-right: 1px solid var(--obsidian-border, rgba(255, 255, 255, 0.06));
  background: var(--obsidian-bg-primary, #1e1e1e) !important;
  border-right-color: var(--obsidian-border, rgba(255, 255, 255, 0.06)) !important;
}

.sidebar-nav .el-menu-item {
  padding: 0 !important;
  justify-content: center;
  height: 40px;
  width: 36px;
  color: var(--obsidian-text-muted, #999) !important;
  background: transparent !important;
  border-radius: 4px;
  margin: 2px 4px;
  transition: color 0.15s ease, background 0.15s ease;
}

.sidebar-nav .el-menu-item:hover {
  color: var(--obsidian-text-normal, #dcddde) !important;
  background: var(--obsidian-bg-hover, #303030) !important;
}

.sidebar-nav .el-menu-item.is-active {
  color: var(--obsidian-text-normal, #dcddde) !important;
  background: var(--obsidian-bg-active, #363636) !important;
  position: relative;
}

.sidebar-nav .el-menu-item.is-active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 9px;
  bottom: 9px;
  width: 2px;
  border-radius: 2px;
  background: var(--obsidian-accent);
}

.sidebar-nav .el-menu-item .el-icon {
  font-size: 16px;
}

.sidebar-content {
  flex: 1;
  overflow: hidden;
  min-width: 0;
  background: var(--obsidian-bg-secondary, #252525);
}

.panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
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
  letter-spacing: 0;
  text-transform: uppercase;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.12s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
