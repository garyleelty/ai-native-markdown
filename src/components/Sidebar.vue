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
      <el-menu-item index="graph" aria-label="知识图谱">
        <el-icon><Share /></el-icon>
      </el-menu-item>
      <el-menu-item index="ai" aria-label="AI 配置">
        <el-icon><MagicStick /></el-icon>
      </el-menu-item>
      <el-menu-item index="settings" aria-label="设置">
        <el-icon><Setting /></el-icon>
      </el-menu-item>
      <el-menu-item index="outline" aria-label="文档大纲">
        <el-icon><List /></el-icon>
      </el-menu-item>
    </el-menu>

    <div class="sidebar-content">
      <Transition name="fade" mode="out-in">
        <FileExplorer
          v-if="activeTab === 'files'"
          ref="fileExplorerRef"
          @select="(path: string) => emit('select', path)"
          @root-path-change="handleRootPathChange"
        />
        <KnowledgePanel
          v-else-if="activeTab === 'graph'"
          :root-path="rootPath"
          @select="(path: string) => emit('select', path)"
        />
        <AIConfigPanel v-else-if="activeTab === 'ai'" />
        <SettingsPanel
          v-else-if="activeTab === 'settings'"
          :is-dark="isDark"
          :show-a-i="showAI"
          @toggle-theme="emit('toggle-theme')"
          @toggle-ai="emit('toggle-ai')"
        />
        <div v-else-if="activeTab === 'outline'" class="panel">
          <div class="panel-header">
            <span class="panel-title">大纲</span>
          </div>
          <OutlinePanel :content="editorContent" :cursor-line="cursorLine" @navigate="handleOutlineNavigate" />
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Folder, Share, MagicStick, Setting, List } from '@element-plus/icons-vue'
import FileExplorer from './sidebar/FileExplorer.vue'
import KnowledgePanel from './sidebar/KnowledgePanel.vue'
import AIConfigPanel from './sidebar/AIConfigPanel.vue'
import SettingsPanel from './sidebar/SettingsPanel.vue'
import OutlinePanel from './editor/OutlinePanel.vue'

interface Props {
  isDark?: boolean
  showAI?: boolean
  editorContent?: string
  cursorLine?: number
}
withDefaults(defineProps<Props>(), { isDark: true, showAI: false, editorContent: '', cursorLine: 0 })

const emit = defineEmits<{
  (e: 'select', path: string): void
  (e: 'toggle-theme'): void
  (e: 'toggle-ai'): void
  (e: 'navigate', lineNumber: number): void
}>()

const activeTab = ref<'files' | 'graph' | 'ai' | 'outline' | 'settings'>('files')
const rootPath = ref('')
const fileExplorerRef = ref()

const handleNavSelect = (index: string) => {
  activeTab.value = index as any
}

const handleRootPathChange = (path: string) => {
  rootPath.value = path
}

const handleOutlineNavigate = (lineNumber: number) => {
  emit('navigate', lineNumber)
}

const readFile = async (filePath: string): Promise<string> => {
  return fileExplorerRef.value?.readFile?.(filePath) ?? ''
}

const saveFile = async (filePath: string, content: string): Promise<boolean> => {
  return fileExplorerRef.value?.saveFile?.(filePath, content) ?? false
}

const handleCreateFile = () => fileExplorerRef.value?.handleCreateFile?.()
const handleCreateFolder = () => fileExplorerRef.value?.handleCreateFolder?.()
const openFolder = () => fileExplorerRef.value?.openFolder?.()
const initDemoWorkspace = () => fileExplorerRef.value?.initDemoWorkspace?.()

defineExpose({ readFile, saveFile, handleCreateFile, handleCreateFolder, openFolder, initDemoWorkspace })
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
  width: 44px;
  color: var(--obsidian-text-muted, #999) !important;
  background: transparent !important;
  transition: color 0.15s ease;
}

.sidebar-nav .el-menu-item:hover {
  color: var(--obsidian-text-normal, #dcddde) !important;
  background: var(--obsidian-bg-hover, #303030) !important;
}

.sidebar-nav .el-menu-item.is-active {
  color: var(--obsidian-accent, #7f6df2) !important;
  background: var(--obsidian-accent-soft, rgba(127, 109, 242, 0.15)) !important;
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
  letter-spacing: 0.06em;
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
