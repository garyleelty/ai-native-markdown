<template>
  <section class="graph-workbench-pane" aria-label="图谱工作区">
    <header class="graph-pane-header">
      <div class="pane-title">
        <el-icon><Share /></el-icon>
        <span>Graph view</span>
      </div>
      <div class="pane-actions">
        <el-button
          :icon="Refresh"
          native-type="button"
          size="small"
          circle
          aria-label="刷新图谱"
          :loading="graphLoading"
          @click="refreshIndex"
        />
        <el-button
          :icon="Close"
          native-type="button"
          size="small"
          circle
          aria-label="关闭图谱工作区"
          @click="$emit('close')"
        />
      </div>
    </header>

    <div class="graph-pane-body">
      <KnowledgeGraph
        v-if="graphData"
        :graph-data="graphData"
        :current-file="currentFile"
        @node-click="node => $emit('select', node.path)"
      />
      <div v-else class="graph-pane-loading" role="status">
        <template v-if="graphError">
          <el-icon :size="20"><Warning /></el-icon>
          <span>{{ graphError }}</span>
        </template>
        <template v-else>
          <el-icon class="is-loading" :size="20"><Loading /></el-icon>
          <span>加载知识图谱...</span>
        </template>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { Close, Loading, Refresh, Share, Warning } from '@element-plus/icons-vue'
import KnowledgeGraph from '@/components/knowledge/KnowledgeGraph.vue'
import { fileSystem } from '@/services/fileSystem'
import { knowledgeIndex } from '@/services/knowledgeIndex'
import type { KnowledgeGraphData } from '@/types'

defineProps<{
  currentFile?: string
}>()

defineEmits<{
  (e: 'select', path: string): void
  (e: 'close'): void
}>()

const graphData = ref<KnowledgeGraphData | null>(null)
const graphLoading = ref(false)
const graphError = ref('')

let isDisposed = false
let graphLoadVersion = 0
let unsubscribeIndex: (() => void) | null = null
let reloadTimer: ReturnType<typeof setTimeout> | null = null

const rebuildIndex = async () => {
  const files = await fileSystem.getAllMarkdownFiles()
  const allFiles = await Promise.all(files.map(async file => ({
    path: file.path,
    content: await fileSystem.readFile(file.path),
  })))
  await knowledgeIndex.rebuild(allFiles)
}

const loadGraphData = async () => {
  const version = ++graphLoadVersion
  graphLoading.value = true
  graphError.value = ''
  try {
    if (await knowledgeIndex.count() === 0 || knowledgeIndex.isStale()) {
      await rebuildIndex()
    }
    const nextGraphData = await knowledgeIndex.buildGraphData()
    if (isDisposed || version !== graphLoadVersion) return
    graphData.value = nextGraphData
  } catch {
    if (!isDisposed && version === graphLoadVersion) {
      graphData.value = null
      graphError.value = '图谱加载失败'
    }
  } finally {
    if (!isDisposed && version === graphLoadVersion) graphLoading.value = false
  }
}

const scheduleReload = () => {
  if (isDisposed) return
  if (reloadTimer) clearTimeout(reloadTimer)
  reloadTimer = setTimeout(() => {
    void loadGraphData()
  }, 120)
}

const refreshIndex = async () => {
  await rebuildIndex()
  await loadGraphData()
}

onMounted(async () => {
  await loadGraphData()
  if (!isDisposed) unsubscribeIndex = knowledgeIndex.subscribe(scheduleReload)
})

onUnmounted(() => {
  isDisposed = true
  graphLoadVersion++
  unsubscribeIndex?.()
  if (reloadTimer) clearTimeout(reloadTimer)
})

</script>

<style scoped>
.graph-workbench-pane {
  height: 100%;
  min-width: 280px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--obsidian-bg-primary);
  border-left: 1px solid var(--obsidian-border);
}

.graph-pane-header {
  height: 36px;
  min-height: 36px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 0 8px 0 12px;
  background: var(--obsidian-bg-modifier);
  border-bottom: 1px solid var(--obsidian-border);
}

.pane-title {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--obsidian-text-muted);
  font-size: 12px;
  font-weight: 600;
}

.pane-title span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pane-actions {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.pane-actions :deep(.el-button) {
  width: 28px;
  height: 28px;
  border: none !important;
  background: transparent !important;
  color: var(--obsidian-text-faint) !important;
}

.pane-actions :deep(.el-button:hover) {
  background: var(--obsidian-bg-hover) !important;
  color: var(--obsidian-text-normal) !important;
}

.graph-pane-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.graph-pane-loading {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--obsidian-text-faint);
  font-size: 12px;
}
</style>
