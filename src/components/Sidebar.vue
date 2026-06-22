<template>
  <div class="sidebar">
    <el-menu
      :default-active="activeTab"
      class="sidebar-nav"
      @select="handleNavSelect"
    >
      <el-menu-item index="files" aria-label="文件管理" title="文件管理">
        <el-icon><Folder /></el-icon>
        <span class="nav-label">文件</span>
      </el-menu-item>
      <el-menu-item index="search" aria-label="全局搜索" title="全局搜索">
        <el-icon><Search /></el-icon>
        <span class="nav-label">搜索</span>
      </el-menu-item>
      <el-menu-item index="knowledge" aria-label="知识图谱" title="知识图谱">
        <el-icon><Share /></el-icon>
        <span class="nav-label">图谱</span>
      </el-menu-item>
      <el-menu-item index="rss" aria-label="RSS 订阅" title="RSS 订阅">
        <el-icon><Document /></el-icon>
        <span class="nav-label">RSS</span>
      </el-menu-item>
      <!-- Plugin-contributed sidebar tabs -->
      <el-menu-item
        v-for="tab in pluginSidebarTabs"
        :key="tab.id"
        :index="tab.id"
        :aria-label="tab.ariaLabel || tab.label"
        :title="tab.label"
      >
        <span class="nav-label">{{ tab.label }}</span>
      </el-menu-item>
      <el-menu-item index="settings" aria-label="设置" title="设置">
        <el-icon><Setting /></el-icon>
        <span class="nav-label">设置</span>
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
        <div v-else-if="activeTab === 'search'" class="panel">
          <div class="panel-header">
            <span class="panel-title">搜索</span>
          </div>
          <GlobalSearchPanel
            @select="payload => emit('search-result-select', payload)"
          />
        </div>
        <div v-else-if="activeTab === 'knowledge'" class="panel">
          <div class="panel-header">
            <span class="panel-title">知识图谱</span>
          </div>
          <KnowledgePanel
            ref="knowledgePanelRef"
            :root-path="rootPath"
            :current-file="currentFile"
            :content="editorContent"
            :cursor-line="cursorLine"
            @select="(path: string) => emit('select', path)"
            @reference-select="reference => emit('reference-select', reference)"
            @wiki-navigate="target => emit('wiki-navigate', target)"
            @link-mention="payload => emit('link-mention', payload)"
            @navigate="line => emit('navigate', line)"
            @insert="text => emit('insert', text)"
          />
        </div>
        <div v-else-if="activeTab === 'rss'" class="panel">
          <div class="panel-header">
            <span class="panel-title">RSS 订阅</span>
          </div>
          <RSSPanel
            @select="(path: string) => emit('select', path)"
          />
        </div>
        <SettingsPanel
          v-else-if="activeTab === 'settings'"
          :is-dark="isDark"
          :show-a-i="showAI"
          @set-theme="dark => emit('set-theme', dark)"
          @toggle-ai="emit('toggle-ai')"
        >
          <template #ai-config>
            <AIConfigPanel />
          </template>
        </SettingsPanel>
        <div v-else-if="activePluginTab" class="panel">
          <div class="panel-header">
            <span class="panel-title">{{ activePluginTab.label }}</span>
          </div>
          <Suspense>
            <component :is="pluginTabComponents[activePluginTab.id]" v-bind="activePluginTab.props?.() ?? {}" />
          </Suspense>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, defineAsyncComponent, watch } from 'vue'
import { Document, Folder, Search, Setting, Share } from '@element-plus/icons-vue'
import FileExplorer from './sidebar/FileExplorer.vue'
import KnowledgePanel from './sidebar/KnowledgePanel.vue'
import RSSPanel from './sidebar/RSSPanel.vue'
import AIConfigPanel from './sidebar/AIConfigPanel.vue'
import SettingsPanel from './sidebar/SettingsPanel.vue'
import GlobalSearchPanel from './sidebar/GlobalSearchPanel.vue'
import { useSettingsStore } from '@/stores/settings'
import { pluginManager } from '@/plugin-system'
import type { SidebarTab } from '@/types'
import { SIDEBAR_TABS } from '@/types'
import type { KnowledgeReference } from '@/services/knowledgeIndex'

interface Props {
  currentFile?: string
  editorContent?: string
  cursorLine?: number
  isDark?: boolean
  showAI?: boolean
}
withDefaults(defineProps<Props>(), { currentFile: '', editorContent: '', cursorLine: 0, isDark: true, showAI: false })

const emit = defineEmits<{
  (e: 'select', path: string): void
  (e: 'search-result-select', payload: { path: string; lineNumber?: number }): void
  (e: 'reference-select', reference: KnowledgeReference): void
  (e: 'wiki-navigate', target: string): void
  (e: 'link-mention', payload: { reference: KnowledgeReference; targetTitle: string; targetNames: string[] }): void
  (e: 'navigate', lineNumber: number): void
  (e: 'renamed', payload: { oldPath: string; newPath: string; isDirectory: boolean; renamedPaths?: Array<{ oldPath: string; newPath: string; isDirectory: boolean }>; updatedLinkPaths?: string[] }): void
  (e: 'deleted', payload: { path: string; isDirectory: boolean }): void
  (e: 'set-theme', dark: boolean): void
  (e: 'toggle-ai'): void
  (e: 'content-change', content: string): void
  (e: 'insert', text: string): void
}>()

const settingsStore = useSettingsStore()
const activeTab = computed(() => settingsStore.activeSidebarTab)

// Plugin-contributed sidebar tabs
const pluginSidebarTabs = computed(() => pluginManager.sidebarTabs.value)
const activePluginTab = computed(() => pluginSidebarTabs.value.find(t => t.id === activeTab.value))
const pluginTabComponents = computed(() => {
  const components: Record<string, any> = {}
  for (const tab of pluginManager.sidebarTabs.value) {
    components[tab.id] = defineAsyncComponent(tab.component)
  }
  return components
})
const rootPath = ref('')
const fileExplorerRef = ref()
const knowledgePanelRef = ref<{ refreshIndex?: (options?: { notify?: boolean; waitForPanels?: boolean }) => Promise<void> } | null>(null)

const handleNavSelect = (index: string) => {
  if ((SIDEBAR_TABS as readonly string[]).includes(index)) {
    settingsStore.setActiveTab(index as SidebarTab)
  } else if (pluginSidebarTabs.value.some(t => t.id === index)) {
    // Plugin tab selected — store in a generic way
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
  if ((SIDEBAR_TABS as readonly string[]).includes(tab)) settingsStore.setActiveTab(tab)
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
  openTab('knowledge')
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
  background: var(--obsidian-bg-secondary);
}

/* 活跃标签指示条 — 仅此组件特有，其余导航样式由 app.css 全局定义 */
.sidebar-nav .el-menu-item.is-active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 10px;
  bottom: 10px;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--obsidian-accent);
  box-shadow: 0 0 8px var(--violet-glow);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s var(--ease-spring);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
