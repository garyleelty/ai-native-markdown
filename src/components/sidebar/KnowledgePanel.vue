<template>
  <div class="panel">
    <div class="panel-header">
      <span class="panel-title">知识</span>
      <el-button :icon="Refresh" size="small" circle aria-label="刷新知识索引" @click="refreshIndex" />
    </div>

    <div class="index-summary">
      <div class="summary-item">
        <strong>{{ graphData?.stats.totalNodes ?? 0 }}</strong>
        <span>笔记</span>
      </div>
      <div class="summary-item">
        <strong>{{ graphData?.stats.totalEdges ?? 0 }}</strong>
        <span>链接</span>
      </div>
      <div class="summary-item">
        <strong>{{ graphData?.stats.orphanCount ?? 0 }}</strong>
        <span>孤立</span>
      </div>
    </div>

    <el-tabs v-model="activeTab" class="knowledge-tabs" stretch>
      <el-tab-pane label="属性" name="properties">
        <div class="tab-content">
          <template v-if="currentRecord">
            <div class="note-title">{{ currentRecord.title }}</div>
            <div class="note-path">{{ currentRecord.filePath }}</div>

            <div class="section" v-if="propertyRows.length">
              <div class="section-label">Frontmatter</div>
              <div class="property-row" v-for="row in propertyRows" :key="row.key">
                <span class="property-key">{{ row.key }}</span>
                <span class="property-value">{{ row.value }}</span>
              </div>
            </div>

            <div class="section" v-if="currentRecord.tags.length">
              <div class="section-label">Tags</div>
              <div class="tag-list">
                <el-tag v-for="tag in currentRecord.tags" :key="tag" size="small" effect="plain">#{{ tag }}</el-tag>
              </div>
            </div>

            <div class="section" v-if="currentRecord.links.length">
              <div class="section-label">Outgoing Links</div>
              <button v-for="link in currentRecord.links" :key="link" class="link-chip">
                [[{{ link }}]]
              </button>
            </div>
          </template>
          <el-empty v-else description="打开 Markdown 文件后查看属性" :image-size="44" />
        </div>
      </el-tab-pane>

      <el-tab-pane :label="`反链 ${backlinks.length}`" name="backlinks">
        <div class="tab-content">
          <ReferenceList
            :items="backlinks"
            empty-text="暂无反链"
            @select="path => emit('select', path)"
          />
        </div>
      </el-tab-pane>

      <el-tab-pane :label="`提及 ${unlinkedMentions.length}`" name="mentions">
        <div class="tab-content">
          <ReferenceList
            :items="unlinkedMentions"
            empty-text="暂无未链接提及"
            @select="path => emit('select', path)"
          />
        </div>
      </el-tab-pane>

      <el-tab-pane label="图谱" name="graph">
        <div class="graph-panel-content">
          <KnowledgeGraph
            v-if="graphData"
            :graph-data="graphData"
            @node-click="handleGraphNodeClick"
          />
          <div class="graph-loading" v-else-if="graphLoading">
            <el-icon class="is-loading" :size="20"><Loading /></el-icon>
            <span>加载中...</span>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Loading, Refresh } from '@element-plus/icons-vue'
import { KnowledgeGraph } from '../knowledge'
import { knowledgeIndex, type KnowledgeIndexRecord, type KnowledgeReference } from '../../services/knowledgeIndex'
import { fileSystem } from '../../services/fileSystem'
import type { GraphNode, KnowledgeGraphData } from '../../types'
import ReferenceList from './ReferenceList.vue'

interface Props {
  rootPath?: string
  currentFile?: string
}
const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'select', path: string): void
}>()

const activeTab = ref('properties')
const graphData = ref<KnowledgeGraphData | null>(null)
const graphLoading = ref(false)
const currentRecord = ref<KnowledgeIndexRecord | null>(null)
const backlinks = ref<KnowledgeReference[]>([])
const unlinkedMentions = ref<KnowledgeReference[]>([])

const propertyRows = computed(() => {
  if (!currentRecord.value) return []
  return Object.entries(currentRecord.value.frontmatter).map(([key, value]) => ({
    key,
    value: Array.isArray(value) ? value.join(', ') : String(value),
  }))
})

const rebuildIndex = async () => {
  const files = await fileSystem.getAllMarkdownFiles()
  const allFiles = await Promise.all(files.map(async file => ({
    path: file.path,
    content: await fileSystem.readFile(file.path),
  })))
  await knowledgeIndex.rebuild(allFiles)
}

const ensureIndexReady = async () => {
  const hasIndexedFiles = await knowledgeIndex.count() > 0
  if (!hasIndexedFiles || knowledgeIndex.isStale()) {
    await rebuildIndex()
  }
}

const loadCurrentFileKnowledge = async () => {
  if (!props.currentFile) {
    currentRecord.value = null
    backlinks.value = []
    unlinkedMentions.value = []
    return
  }

  currentRecord.value = await knowledgeIndex.getByPath(props.currentFile) ?? null
  backlinks.value = await knowledgeIndex.getBacklinks(props.currentFile)
  unlinkedMentions.value = await knowledgeIndex.getUnlinkedMentions(props.currentFile)
}

const loadGraphData = async () => {
  graphLoading.value = true
  try {
    graphData.value = await knowledgeIndex.buildGraphData()
  } catch {
    ElMessage.error('加载知识索引失败')
  } finally {
    graphLoading.value = false
  }
}

const refreshIndex = async () => {
  try {
    await rebuildIndex()
    await Promise.all([loadCurrentFileKnowledge(), loadGraphData()])
    ElMessage.success('知识索引已刷新')
  } catch {
    ElMessage.error('刷新知识索引失败')
  }
}

const handleGraphNodeClick = (node: GraphNode) => { emit('select', node.path) }

let unsubscribeIndex: (() => void) | null = null
let reloadTimer: ReturnType<typeof setTimeout> | null = null

const scheduleReload = () => {
  if (reloadTimer) clearTimeout(reloadTimer)
  reloadTimer = setTimeout(() => {
    Promise.all([loadCurrentFileKnowledge(), loadGraphData()])
  }, 120)
}

onMounted(async () => {
  try {
    await ensureIndexReady()
    await Promise.all([loadCurrentFileKnowledge(), loadGraphData()])
    unsubscribeIndex = knowledgeIndex.subscribe(scheduleReload)
  } catch {
    ElMessage.error('初始化知识索引失败')
  }
})

onUnmounted(() => {
  if (unsubscribeIndex) unsubscribeIndex()
  if (reloadTimer) clearTimeout(reloadTimer)
})

watch(() => props.currentFile, () => {
  loadCurrentFileKnowledge()
})

watch(() => props.rootPath, async (newPath, oldPath) => {
  if (newPath && newPath !== oldPath) await refreshIndex()
})
</script>

<style scoped>
.panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--obsidian-bg-secondary, #252525);
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

.panel-header :deep(.el-button) {
  background: transparent !important;
  border: none !important;
  color: var(--obsidian-text-faint, #666) !important;
}

.panel-header :deep(.el-button:hover) {
  color: var(--obsidian-text-normal, #dcddde) !important;
  background: var(--obsidian-bg-hover, #303030) !important;
}

.index-summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
  padding: 8px;
  border-bottom: 1px solid var(--obsidian-border, rgba(255, 255, 255, 0.06));
}

.summary-item {
  min-width: 0;
  padding: 7px 8px;
  background: var(--obsidian-bg-primary, #1e1e1e);
  border-radius: 4px;
}

.summary-item strong {
  display: block;
  font-size: 15px;
  line-height: 1.1;
  color: var(--obsidian-text-normal, #dcddde);
}

.summary-item span {
  display: block;
  margin-top: 2px;
  font-size: 10px;
  color: var(--obsidian-text-faint, #666);
}

.knowledge-tabs {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.knowledge-tabs :deep(.el-tabs__header) {
  margin: 0;
  padding: 0 6px;
  border-bottom-color: var(--obsidian-border, rgba(255, 255, 255, 0.06));
}

.knowledge-tabs :deep(.el-tabs__nav-wrap::after) {
  display: none;
}

.knowledge-tabs :deep(.el-tabs__item) {
  height: 32px;
  padding: 0 6px;
  font-size: 11px;
  color: var(--obsidian-text-muted, #999);
}

.knowledge-tabs :deep(.el-tabs__item.is-active) {
  color: var(--obsidian-accent, #7f6df2);
}

.knowledge-tabs :deep(.el-tabs__content) {
  flex: 1;
  min-height: 0;
}

.knowledge-tabs :deep(.el-tab-pane) {
  height: 100%;
}

.tab-content {
  height: 100%;
  overflow-y: auto;
  padding: 10px 10px 16px;
}

.note-title {
  font-size: 14px;
  font-weight: 650;
  color: var(--obsidian-text-normal, #dcddde);
  line-height: 1.35;
}

.note-path {
  margin-top: 3px;
  font-size: 10px;
  color: var(--obsidian-text-faint, #666);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.section {
  margin-top: 14px;
}

.section-label {
  margin-bottom: 6px;
  font-size: 10px;
  font-weight: 650;
  color: var(--obsidian-text-faint, #666);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.property-row {
  display: grid;
  grid-template-columns: minmax(64px, 35%) 1fr;
  gap: 8px;
  padding: 5px 0;
  border-bottom: 1px solid var(--obsidian-border, rgba(255, 255, 255, 0.06));
  font-size: 12px;
}

.property-key {
  color: var(--obsidian-text-faint, #666);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.property-value {
  color: var(--obsidian-text-muted, #999);
  overflow-wrap: anywhere;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.link-chip {
  display: block;
  width: 100%;
  padding: 5px 6px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--obsidian-accent, #7f6df2);
  font-size: 12px;
  text-align: left;
}

.link-chip:hover {
  background: var(--obsidian-bg-hover, #303030);
}

.graph-panel-content {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.graph-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 32px;
  color: var(--obsidian-text-faint, #666);
  font-size: 12px;
}

.panel :deep(.reference-list) {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.panel :deep(.reference-item) {
  width: 100%;
  padding: 8px;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.panel :deep(.reference-item:hover) {
  background: var(--obsidian-bg-hover, #303030);
}

.panel :deep(.reference-title) {
  display: block;
  font-size: 12px;
  font-weight: 650;
  color: var(--obsidian-text-normal, #dcddde);
}

.panel :deep(.reference-path) {
  display: block;
  margin-top: 2px;
  font-size: 10px;
  color: var(--obsidian-text-faint, #666);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.panel :deep(.reference-excerpt) {
  display: block;
  margin-top: 4px;
  font-size: 11px;
  line-height: 1.45;
  color: var(--obsidian-text-muted, #999);
}

.panel :deep(.empty-inline) {
  padding: 28px 10px;
  color: var(--obsidian-text-faint, #666);
  font-size: 12px;
  text-align: center;
}

.panel :deep(.el-empty__description p) {
  color: var(--obsidian-text-faint, #666);
}
</style>
