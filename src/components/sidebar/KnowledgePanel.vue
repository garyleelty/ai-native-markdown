<template>
  <div class="panel">
    <div class="panel-header">
      <span class="panel-title">知识</span>
      <div class="panel-header-actions">
        <el-tooltip :content="viewMode === 'simple' ? '切换到高级模式' : '切换到简洁模式'" placement="bottom">
          <el-button
            :icon="viewMode === 'simple' ? MoreFilled : Sunny"
            native-type="button"
            size="small"
            circle
            :aria-label="viewMode === 'simple' ? '切换到高级模式' : '切换到简洁模式'"
            @click="toggleViewMode"
          />
        </el-tooltip>
        <el-button :icon="Refresh" native-type="button" size="small" circle aria-label="刷新知识索引" @click="refreshIndex" />
      </div>
    </div>

    <div class="index-summary" :class="{ 'is-loading': indexLoading }">
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
      <div v-if="indexLoading" class="index-loading-overlay">
        <el-icon class="is-loading" :size="14"><Loading /></el-icon>
        <span>索引构建中...</span>
      </div>
    </div>

    <div class="mode-hint">
      {{ viewMode === 'simple' ? '简洁模式：优先显示大纲、反链和图谱。' : '高级模式：显示属性、提及和图谱洞察。' }}
    </div>

    <el-tabs v-model="activeTab" class="knowledge-tabs" stretch>
      <el-tab-pane label="大纲" name="outline">
        <div class="tab-content">
          <OutlinePanel
            v-if="props.content"
            :content="props.content"
            :cursor-line="props.cursorLine ?? 0"
            @navigate="line => emit('navigate', line)"
          />
          <el-empty v-else description="打开 Markdown 文件后查看大纲" :image-size="44" />

          <div v-if="isAdvancedMode && currentRecord?.links.length" class="section outline-link-section">
            <div class="section-label">外链</div>
            <button
              v-for="link in currentRecord.links"
              :key="link"
              type="button"
              class="link-chip"
              @click="emit('wiki-navigate', link)"
            >
              [[{{ link }}]]
            </button>
          </div>

          <el-collapse v-if="isAdvancedMode && currentRecord" class="inline-knowledge-collapse">
            <el-collapse-item name="properties">
              <template #title>
                <span>属性</span>
                <span class="inline-count">{{ propertyRows.length + currentRecord.tags.length + currentRecord.links.length }}</span>
              </template>
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
            </el-collapse-item>
          </el-collapse>
        </div>
      </el-tab-pane>

      <el-tab-pane :label="`反链 ${backlinks.length}`" name="backlinks">
        <div class="tab-content">
          <ReferenceList
            :items="backlinks"
            empty-text="暂无反链"
            @select="item => emit('reference-select', item)"
          />
        </div>
      </el-tab-pane>

      <el-tab-pane v-if="isAdvancedMode" :label="`提及 ${unlinkedMentions.length}`" name="mentions">
        <div class="tab-content">
          <ReferenceList
            :items="unlinkedMentions"
            empty-text="暂无未链接提及"
            action-label="链接"
            @select="item => emit('reference-select', item)"
            @action="item => handleLinkMention(item)"
          />
        </div>
      </el-tab-pane>

      <el-tab-pane label="图谱" name="graph" lazy>
        <div class="graph-panel-content">
          <KnowledgeGraph
            v-if="graphData"
            :graph-data="graphData"
            :current-file="props.currentFile"
            @node-click="handleGraphNodeClick"
          />
          <div class="graph-loading" v-else-if="graphLoading">
            <el-icon class="is-loading" :size="20"><Loading /></el-icon>
            <span>加载中...</span>
          </div>

          <el-collapse v-if="isAdvancedMode" class="inline-knowledge-collapse graph-insights-collapse">
            <el-collapse-item name="insights">
              <template #title>
                <span>洞察</span>
                <span class="inline-count">{{ connectionSuggestions.length }}</span>
              </template>
              <div class="graph-insights-panel">
                <div class="graph-insights-header">
                  <span class="graph-insights-title">图谱洞察</span>
                  <el-button
                    :icon="Refresh"
                    native-type="button"
                    circle
                    size="small"
                    aria-label="刷新"
                    @click="refreshGraphInsights"
                    :loading="insightsLoading"
                    title="刷新"
                  />
                </div>
                <div class="graph-stats">
                  <div class="stat-item">
                    <span class="stat-value">{{ graphInsightsStats.totalNotes }}</span>
                    <span class="stat-label">笔记</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-value">{{ graphInsightsStats.totalLinks }}</span>
                    <span class="stat-label">连接</span>
                  </div>
                  <div class="stat-item" :class="{ warning: graphInsightsStats.orphanCount > 0 }">
                    <span class="stat-value">{{ graphInsightsStats.orphanCount }}</span>
                    <span class="stat-label">孤立</span>
                  </div>
                  <div v-if="currentNotePosition" class="stat-item" :class="{ success: currentNotePosition.linkCount > 0, muted: currentNotePosition.isOrphan }">
                    <span class="stat-value">{{ currentNotePosition.linkCount }}</span>
                    <span class="stat-label">当前连接</span>
                  </div>
                </div>

                <div v-if="connectionSuggestions.length > 0" class="suggestions-section">
                  <div class="suggestions-header">推荐连接</div>
                  <div class="suggestion-list">
                    <div
                      v-for="sug in connectionSuggestions"
                      :key="`${sug.type}-${sug.path}`"
                      class="suggestion-item"
                      :class="sug.type"
                      @click="handleSuggestionClick(sug)"
                    >
                      <span class="suggestion-icon">{{ getSuggestionIcon(sug.type) }}</span>
                      <div class="suggestion-content">
                        <span class="suggestion-note">{{ sug.note }}</span>
                        <span class="suggestion-reason">{{ sug.reason }}</span>
                      </div>
                      <span class="suggestion-action">+ 链接</span>
                    </div>
                  </div>
                </div>
                <div v-else class="no-suggestions">
                  <span>暂无连接建议</span>

                <!-- AI Knowledge Analysis -->
                <div class="ai-analysis-section">
                  <div class="ai-analysis-header">
                    <el-icon><MagicStick /></el-icon>
                    <span>AI 知识分析</span>
                  </div>
                  <button
                    type="button"
                    class="ai-analysis-btn"
                    @click="runAIAnalysis"
                    :disabled="aiAnalyzing"
                  >
                    <el-icon><Promotion /></el-icon>
                    <span>{{ aiAnalyzing ? '分析中...' : '分析知识图谱' }}</span>
                  </button>
                  <div v-if="aiAnalysisResult" class="ai-analysis-result">
                    <div class="analysis-content">{{ aiAnalysisResult }}</div>
                  </div>
                </div>
                </div>
              </div>
            </el-collapse-item>
          </el-collapse>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref, watch } from 'vue'
import { safeStorage } from '@/utils/security'
import { ElMessage } from 'element-plus'
import { Loading, Refresh, MoreFilled, Sunny } from '@element-plus/icons-vue'
import { knowledgeIndex, type KnowledgeIndexRecord, type KnowledgeReference } from '../../services/knowledgeIndex'
import type { GraphNode, KnowledgeGraphData } from '../../types'
import ReferenceList from './ReferenceList.vue'
import OutlinePanel from '../editor/OutlinePanel.vue'

const KnowledgeGraph = defineAsyncComponent(() => import('../knowledge/KnowledgeGraph.vue'))

interface Props {
  rootPath?: string
  currentFile?: string
  content?: string
  cursorLine?: number
}
const props = withDefaults(defineProps<Props>(), {
  content: '',
  cursorLine: 0,
})

const emit = defineEmits<{
  (e: 'select', path: string): void
  (e: 'reference-select', reference: KnowledgeReference): void
  (e: 'wiki-navigate', target: string): void
  (e: 'link-mention', payload: { reference: KnowledgeReference; targetTitle: string; targetNames: string[] }): void
  (e: 'navigate', lineNumber: number): void
  (e: 'insert', text: string): void
}>()

const activeTab = ref('outline')
const graphData = ref<KnowledgeGraphData | null>(null)
const graphLoading = ref(false)
const indexLoading = ref(false)
const currentRecord = ref<KnowledgeIndexRecord | null>(null)
const backlinks = ref<KnowledgeReference[]>([])
const unlinkedMentions = ref<KnowledgeReference[]>([])
const insightsLoading = ref(false)
const graphInsightsData = ref<GraphInsights | null>(null)

const VIEW_MODE_KEY = 'ai-markdown-knowledge-panel-view-mode'
const viewMode = ref<'simple' | 'advanced'>(safeStorage.get(VIEW_MODE_KEY, 'advanced'))
const isAdvancedMode = computed(() => viewMode.value === 'advanced')
const toggleViewMode = () => {
  viewMode.value = viewMode.value === 'simple' ? 'advanced' : 'simple'
}

type GraphInsights = {
  totalNotes: number
  totalLinks: number
  orphanCount: number
  currentNotePosition?: {
    linkCount: number
    isOrphan: boolean
    neighbors: Array<{ title: string; path: string }>
  }
  suggestions?: Array<{ type: string; note: string; path: string; reason: string; priority?: number }>
}

const graphInsightsStats = computed(() => {
  const totalNotes = graphInsightsData.value?.totalNotes ?? 0
  const totalLinks = graphInsightsData.value?.totalLinks ?? 0
  return {
    totalNotes,
    totalLinks,
    orphanCount: graphInsightsData.value?.orphanCount ?? 0,
    avgLinkCount: totalNotes > 0 ? (totalLinks / totalNotes).toFixed(1) : '0',
  }
})

const currentNotePosition = computed(() => graphInsightsData.value?.currentNotePosition)
const connectionSuggestions = computed(() => graphInsightsData.value?.suggestions ?? [])

// AI Knowledge Analysis
const aiAnalyzing = ref(false)
const aiAnalysisResult = ref('')

const runAIAnalysis = async () => {
  if (aiAnalyzing.value) return
  aiAnalyzing.value = true
  aiAnalysisResult.value = ''

  try {
    // Simulate AI analysis - in real implementation, this would call the AI service
    await new Promise(resolve => setTimeout(resolve, 1500))

    const stats = graphInsightsStats.value
    const suggestions = connectionSuggestions.value

    let analysis = `📊 知识图谱分析：\n\n`
    analysis += `• 共 ${stats.totalNotes} 篇笔记，${stats.totalLinks} 个链接\n`
    analysis += `• 平均每篇笔记 ${stats.avgLinkCount} 个链接\n`
    analysis += `• ${stats.orphanCount} 篇孤立笔记需要连接\n\n`

    if (suggestions.length > 0) {
      analysis += `💡 发现 ${suggestions.length} 个潜在连接：\n`
      suggestions.slice(0, 3).forEach((sug, i) => {
        analysis += `${i + 1}. ${sug.note} - ${sug.reason}\n`
      })
    }

    if (currentNotePosition.value) {
      analysis += `\n📝 当前笔记：\n`
      analysis += `• ${currentNotePosition.value.linkCount} 个连接\n`
      if (currentNotePosition.value.isOrphan) {
        analysis += `• ⚠️ 这是孤立笔记，建议添加链接\n`
      }
      if (currentNotePosition.value.neighbors.length > 0) {
        analysis += `• 关联笔记：${currentNotePosition.value.neighbors.slice(0, 3).map(n => n.title).join('、')}\n`
      }
    }

    aiAnalysisResult.value = analysis
  } catch (error) {
    aiAnalysisResult.value = '分析失败，请重试'
  } finally {
    aiAnalyzing.value = false
  }
}

interface RefreshIndexOptions {
  notify?: boolean
  waitForPanels?: boolean
}

const propertyRows = computed(() => {
  if (!currentRecord.value) return []
  return Object.entries(currentRecord.value.frontmatter).map(([key, value]) => ({
    key,
    value: Array.isArray(value) ? value.join(', ') : String(value),
  }))
})

const rebuildIndex = async () => {
  indexLoading.value = true
  try {
    await knowledgeIndex.rebuildFromFiles()
  } finally {
    indexLoading.value = false
  }
}

const ensureIndexReady = async () => {
  const hasIndexedFiles = await knowledgeIndex.count() > 0
  if (!hasIndexedFiles || knowledgeIndex.isStale()) {
    await rebuildIndex()
  }
}

const loadCurrentFileKnowledge = async () => {
  const filePath = props.currentFile
  const version = ++currentKnowledgeLoadVersion
  if (!filePath) {
    currentRecord.value = null
    backlinks.value = []
    unlinkedMentions.value = []
    return
  }

  const [record, nextBacklinks, nextMentions] = await Promise.all([
    knowledgeIndex.getByPath(filePath),
    knowledgeIndex.getBacklinks(filePath),
    knowledgeIndex.getUnlinkedMentions(filePath),
  ])
  if (isDisposed || version !== currentKnowledgeLoadVersion || props.currentFile !== filePath) return
  currentRecord.value = record ?? null
  backlinks.value = nextBacklinks
  unlinkedMentions.value = nextMentions
}

const loadGraphData = async () => {
  const version = ++graphLoadVersion
  graphLoading.value = true
  try {
    const nextGraphData = await knowledgeIndex.buildGraphData()
    if (isDisposed || version !== graphLoadVersion) return
    graphData.value = nextGraphData
  } catch {
    if (!isDisposed && version === graphLoadVersion) ElMessage.error('加载知识索引失败')
  } finally {
    if (!isDisposed && version === graphLoadVersion) graphLoading.value = false
  }
}

const refreshIndex = async (options: RefreshIndexOptions = {}) => {
  const notify = options.notify ?? true
  const waitForPanels = options.waitForPanels ?? true
  try {
    await rebuildIndex()
    if (isDisposed) return
    const reloadPanels = Promise.all([loadCurrentFileKnowledge(), loadGraphData()])
    if (waitForPanels) {
      await reloadPanels
    } else {
      void reloadPanels.catch(() => {})
    }
    if (!isDisposed && notify) ElMessage.success('知识索引已刷新')
  } catch (error) {
    if (!notify) throw error
    if (!isDisposed) ElMessage.error('刷新知识索引失败')
  }
}

const handleGraphNodeClick = (node: GraphNode) => { emit('select', node.path) }
const handleLinkMention = (reference: KnowledgeReference) => {
  if (!currentRecord.value) return
  emit('link-mention', {
    reference,
    targetTitle: currentRecord.value.title,
    targetNames: [currentRecord.value.title, ...currentRecord.value.aliases],
  })
}

const getSuggestionIcon = (type: string): string => {
  switch (type) {
    case 'connect-orphan': return '🔗'
    case 'similar-topic': return '🏷️'
    case 'missing-link': return '⭐'
    default: return '📌'
  }
}

type ConnectionSuggestion = NonNullable<GraphInsights['suggestions']>[number]

const getEndpointPath = (endpoint: string | GraphNode): string => (
  typeof endpoint === 'string' ? endpoint : endpoint.path
)

const getNeighborPaths = (gData: KnowledgeGraphData, currentPath: string): Set<string> => {
  const neighborPaths = new Set<string>()
  gData.edges.forEach(edge => {
    const source = getEndpointPath(edge.source)
    const target = getEndpointPath(edge.target)
    if (source === currentPath) neighborPaths.add(target)
    if (target === currentPath) neighborPaths.add(source)
  })
  return neighborPaths
}

const buildConnectionSuggestions = (
  gData: KnowledgeGraphData,
  currentNode: GraphNode,
  neighborPaths: Set<string>
): ConnectionSuggestion[] => {
  const currentTags = new Set(currentNode.tags)
  const excludedPaths = new Set<string>([currentNode.path, ...neighborPaths])
  const suggestions = new Map<string, ConnectionSuggestion & { priority: number }>()

  if (currentNode.isOrphan && gData.stats.orphanCount > 1) {
    gData.nodes
      .filter(node => node.isOrphan && !excludedPaths.has(node.path))
      .slice(0, 3)
      .forEach(node => {
        suggestions.set(node.path, {
          type: 'connect-orphan',
          note: node.label,
          path: node.path,
          reason: '同为孤立笔记，可考虑建立入口连接',
          priority: 3,
        })
      })
  }

  if (currentTags.size > 0) {
    gData.nodes
      .map(node => ({
        node,
        sharedTags: node.tags.filter(tag => currentTags.has(tag)),
      }))
      .filter(item => item.sharedTags.length > 0 && !excludedPaths.has(item.node.path))
      .sort((a, b) => b.sharedTags.length - a.sharedTags.length || b.node.linkCount - a.node.linkCount)
      .slice(0, 5)
      .forEach(({ node, sharedTags }) => {
        suggestions.set(node.path, {
          type: 'similar-topic',
          note: node.label,
          path: node.path,
          reason: `共享标签: ${sharedTags.join(', ')}`,
          priority: 2,
        })
      })
  }

  gData.nodes
    .filter(node => node.linkCount >= 3 && !excludedPaths.has(node.path))
    .sort((a, b) => b.linkCount - a.linkCount)
    .slice(0, 5)
    .forEach(node => {
      if (suggestions.has(node.path)) return
      suggestions.set(node.path, {
        type: 'missing-link',
        note: node.label,
        path: node.path,
        reason: `高连接中心节点（${node.linkCount} 条连接）`,
        priority: 1,
      })
    })

  return [...suggestions.values()]
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
    .slice(0, 10)
    .map(({ priority: _priority, ...suggestion }) => suggestion)
}

let insightsLoadVersion = 0

const refreshGraphInsights = async () => {
  const version = ++insightsLoadVersion
  insightsLoading.value = true
  try {
    const gData = await knowledgeIndex.buildGraphData()
    if (isDisposed || version !== insightsLoadVersion) return

    const insights: GraphInsights = {
      totalNotes: gData.stats.totalNodes,
      totalLinks: gData.stats.totalEdges,
      orphanCount: gData.stats.orphanCount,
      suggestions: [],
    }

    if (props.currentFile) {
      const currentNode = gData.nodes.find(node => node.path === props.currentFile)
      if (currentNode) {
        const neighborPaths = getNeighborPaths(gData, props.currentFile)
        insights.currentNotePosition = {
          linkCount: currentNode.linkCount,
          isOrphan: currentNode.isOrphan,
          neighbors: gData.nodes
            .filter(node => neighborPaths.has(node.path))
            .map(node => ({ title: node.label, path: node.path })),
        }
        insights.suggestions = buildConnectionSuggestions(gData, currentNode, neighborPaths)
      }
    }

    graphInsightsData.value = insights
  } catch (e) {
    if (!isDisposed && version === insightsLoadVersion) {
      console.error('Failed to load graph insights:', e)
    }
  } finally {
    if (!isDisposed && version === insightsLoadVersion) {
      insightsLoading.value = false
    }
  }
}

const handleSuggestionClick = (sug: ConnectionSuggestion) => {
  const noteName = sug.path.split('/').pop()?.replace(/\.(md|markdown)$/i, '') || sug.note
  const wikiLink = `[[${noteName}]]`
  emit('insert', wikiLink)
  emit('select', sug.path)
}

let unsubscribeIndex: (() => void) | null = null
let reloadTimer: ReturnType<typeof setTimeout> | null = null
let isDisposed = false
let currentKnowledgeLoadVersion = 0
let graphLoadVersion = 0

const scheduleReload = () => {
  if (isDisposed) return
  if (reloadTimer) clearTimeout(reloadTimer)
  reloadTimer = setTimeout(() => {
    if (!isDisposed) {
      void loadCurrentFileKnowledge()
      // 图谱数据按需加载：仅当图谱标签页可见时才重建
      if (activeTab.value === 'graph') void loadGraphData()
    }
  }, 120)
}

onMounted(async () => {
  try {
    await ensureIndexReady()
    if (isDisposed) return
    await loadCurrentFileKnowledge()
    // 图谱数据延迟加载：仅当图谱标签页为默认激活标签时才加载
    if (activeTab.value === 'graph') await loadGraphData()
    if (!isDisposed) unsubscribeIndex = knowledgeIndex.subscribe(scheduleReload)
    // 初始化视图模式，简洁模式下不可见 mentions 标签时自动切换
    if (viewMode.value === 'simple' && activeTab.value === 'mentions') {
      activeTab.value = 'outline'
    }
  } catch {
    if (!isDisposed) ElMessage.error('初始化知识索引失败')
  }
})

onUnmounted(() => {
  isDisposed = true
  currentKnowledgeLoadVersion++
  graphLoadVersion++
  insightsLoadVersion++
  if (unsubscribeIndex) unsubscribeIndex()
  if (reloadTimer) clearTimeout(reloadTimer)
})

watch(activeTab, async (tab) => {
  if (tab === 'graph' && !graphData.value) {
    await loadGraphData()
  }
  if (tab === 'graph' && isAdvancedMode.value && !graphInsightsData.value) {
    await refreshGraphInsights()
  }
})

watch(() => props.currentFile, () => {
  void loadCurrentFileKnowledge()
  // 图谱数据按需加载：仅当图谱标签页可见时才重建
  if (activeTab.value === 'graph') void loadGraphData()
  graphInsightsData.value = null
})

watch(viewMode, (mode) => {
  safeStorage.set(VIEW_MODE_KEY, mode)
  if (mode === 'simple' && activeTab.value === 'mentions') {
    activeTab.value = 'outline'
  }
})

watch(() => props.rootPath, async (newPath, oldPath) => {
  if (newPath && newPath !== oldPath) await refreshIndex()
})

defineExpose({ refreshIndex })
</script>

<style scoped>

.panel-header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.mode-hint {
  margin: 0 10px 8px;
  padding: 7px 8px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--obsidian-accent-soft, #7f6df2) 10%, transparent);
  color: var(--obsidian-text-faint, #666);
  font-size: 11px;
  line-height: 1.45;
}

.index-summary {
  position: relative;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
  padding: 8px;
  border-bottom: 1px solid var(--obsidian-border, rgba(255, 255, 255, 0.06));
}

.index-loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: color-mix(in srgb, var(--obsidian-bg-secondary, #252525) 85%, transparent);
  border-radius: 4px;
  color: var(--obsidian-text-faint, #666);
  font-size: 11px;
  z-index: 1;
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

.inline-knowledge-collapse {
  margin-top: 12px;
  border: 1px solid var(--obsidian-border, rgba(255, 255, 255, 0.06));
  border-radius: 6px;
  background: var(--obsidian-bg-primary, #1e1e1e);
  overflow: hidden;
}

.inline-knowledge-collapse :deep(.el-collapse-item__header) {
  height: 34px;
  padding: 0 10px;
  border-bottom-color: var(--obsidian-border, rgba(255, 255, 255, 0.06));
  background: transparent;
  color: var(--obsidian-text-normal, #dcddde);
  font-size: 12px;
  font-weight: 650;
}

.inline-knowledge-collapse :deep(.el-collapse-item__wrap) {
  border-bottom: 0;
  background: transparent;
}

.inline-knowledge-collapse :deep(.el-collapse-item__content) {
  padding: 0 10px 10px;
}

.inline-count {
  margin-left: 6px;
  color: var(--obsidian-text-faint, #666);
  font-size: 11px;
  font-weight: 500;
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
  font-weight: 650;
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

.link-chip,
.property-link-chip {
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

.link-chip:hover,
.property-link-chip:hover {
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
  display: flex;
  align-items: stretch;
  gap: 6px;
  border-radius: 5px;
}

.panel :deep(.reference-main) {
  flex: 1 1 auto;
  min-width: 0;
  padding: 8px;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.panel :deep(.reference-main:hover) {
  background: var(--obsidian-bg-hover, #303030);
}

.panel :deep(.reference-action) {
  align-self: center;
  flex: 0 0 auto;
  min-width: 40px;
  height: 24px;
  padding: 0 8px;
  border: 1px solid color-mix(in srgb, var(--obsidian-accent) 34%, transparent);
  border-radius: 5px;
  background: color-mix(in srgb, var(--obsidian-accent) 12%, transparent);
  color: var(--obsidian-accent);
  font-size: 11px;
  font-weight: 650;
  cursor: pointer;
}

.panel :deep(.reference-action:hover) {
  background: color-mix(in srgb, var(--obsidian-accent) 20%, transparent);
}

.panel :deep(.reference-title) {
  min-width: 0;
  font-size: 12px;
  font-weight: 650;
  color: var(--obsidian-text-normal, #dcddde);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.panel :deep(.reference-heading) {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.panel :deep(.reference-line) {
  flex: 0 0 auto;
  padding: 1px 5px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--obsidian-accent) 16%, transparent);
  color: var(--obsidian-accent);
  font-size: 10px;
  font-weight: 650;
  line-height: 1.4;
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

.graph-insights-panel {
  height: 100%;
  overflow-y: auto;
  padding: 10px;
}

.graph-insights-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.graph-insights-title {
  font-size: 11px;
  font-weight: 650;
  color: var(--obsidian-text-muted, #999);
  text-transform: uppercase;
}

.graph-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(60px, 1fr));
  gap: 4px;
  margin-bottom: 14px;
}

.stat-item {
  padding: 8px;
  background: var(--obsidian-bg-primary, #1e1e1e);
  border-radius: 4px;
  text-align: center;
}

.stat-item.warning {
  background: color-mix(in srgb, #f0a020 12%, var(--obsidian-bg-primary));
}

.stat-item.success {
  background: color-mix(in srgb, var(--obsidian-accent) 12%, var(--obsidian-bg-primary));
}

.stat-item.muted {
  background: color-mix(in srgb, #999 8%, var(--obsidian-bg-primary));
}

.stat-value {
  display: block;
  font-size: 14px;
  font-weight: 650;
  color: var(--obsidian-text-normal, #dcddde);
  line-height: 1;
}

.stat-label {
  display: block;
  margin-top: 2px;
  font-size: 10px;
  color: var(--obsidian-text-faint, #666);
}

.suggestions-section {
  margin-top: 6px;
}

.suggestions-header {
  margin-bottom: 6px;
  font-size: 10px;
  font-weight: 650;
  color: var(--obsidian-text-faint, #666);
  text-transform: uppercase;
}

.suggestion-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.suggestion-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 5px;
  background: var(--obsidian-bg-primary, #1e1e1e);
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.suggestion-item:hover {
  background: var(--obsidian-bg-hover, #303030);
}

.suggestion-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.suggestion-content {
  flex: 1;
  min-width: 0;
}

.suggestion-note {
  display: block;
  font-size: 12px;
  font-weight: 550;
  color: var(--obsidian-text-normal, #dcddde);
  line-height: 1.2;
}

.suggestion-reason {
  display: block;
  margin-top: 2px;
  font-size: 10px;
  color: var(--obsidian-text-faint, #666);
}

.suggestion-action {
  font-size: 10px;
  font-weight: 650;
  color: var(--obsidian-accent, #7f6df2);
  flex-shrink: 0;
}

.no-suggestions {
  padding: 24px 10px;
  color: var(--obsidian-text-faint, #666);
  font-size: 12px;
  text-align: center;
}

/* AI Analysis Section */
.ai-analysis-section {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--obsidian-border);
}

.ai-analysis-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--obsidian-accent);
}

.ai-analysis-header .el-icon {
  font-size: 16px;
}

.ai-analysis-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px;
  background: var(--obsidian-accent-soft);
  border: 1px solid var(--obsidian-accent);
  border-radius: var(--radius-md);
  color: var(--obsidian-accent);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s var(--ease-spring);
}

.ai-analysis-btn:hover {
  background: var(--obsidian-accent);
  color: #fff;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px var(--violet-glow);
}

.ai-analysis-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.ai-analysis-btn .el-icon {
  font-size: 16px;
}

.ai-analysis-result {
  margin-top: 12px;
  padding: 12px;
  background: var(--obsidian-bg-primary);
  border: 1px solid var(--obsidian-border);
  border-radius: var(--radius-md);
  animation: analysis-in 0.3s var(--ease-spring) both;
}

@keyframes analysis-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.analysis-content {
  font-size: 12px;
  line-height: 1.6;
  color: var(--obsidian-text-normal);
  white-space: pre-wrap;
}
</style>
