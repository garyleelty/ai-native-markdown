<template>
  <div class="knowledge-graph">
    <div class="graph-toolbar">
      <div class="toolbar-search">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input
          type="text"
          v-model="searchQuery"
          class="toolbar-search-input"
          placeholder="搜索笔记..."
          aria-label="搜索图谱笔记"
          @input="handleSearch"
          @keydown.enter.prevent="openFirstSearchResult"
          @keydown.escape.prevent="clearSearch"
        />
      </div>
      <div class="graph-mode-toggle" role="group" aria-label="图谱视图模式">
        <button
          type="button"
          class="mode-btn"
          :class="{ active: graphMode === 'global' }"
          aria-label="全局图谱"
          :aria-pressed="graphMode === 'global'"
          @click="graphMode = 'global'"
        >
          全局
        </button>
        <button
          type="button"
          class="mode-btn"
          :class="{ active: graphMode === 'current' }"
          aria-label="当前笔记图谱"
          :aria-pressed="graphMode === 'current'"
          @click="graphMode = 'current'"
        >
          当前
        </button>
      </div>
      <button
        type="button"
        class="toolbar-btn"
        @click="handleRefresh"
        title="刷新图谱"
        aria-label="刷新图谱"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
      </button>
    </div>

    <div v-if="graphMode === 'current'" class="graph-focus-summary" role="status">
      <span class="focus-title">{{ currentFocusLabel }}</span>
      <span>{{ currentNeighborCount }} 个邻居</span>
    </div>

    <div v-if="hasSearchQuery" class="graph-search-results" role="list" aria-label="图谱搜索结果">
      <button
        v-for="node in searchResults"
        :key="node.id"
        type="button"
        class="graph-search-result"
        :aria-label="`打开图谱节点 ${node.label}`"
        @click="openNode(node)"
      >
        <span class="result-main">
          <span class="result-title">{{ node.label }}</span>
          <span class="result-path">{{ node.path }}</span>
        </span>
        <span class="result-meta">
          <span>{{ node.linkCount }} 链接</span>
          <span v-if="node.isOrphan">孤立</span>
        </span>
      </button>
      <div v-if="searchResults.length === 0" class="graph-search-empty">
        没有匹配笔记
      </div>
    </div>

    <div v-show="canRenderGraph" ref="graphContainer" class="graph-canvas"></div>
    <div v-if="!canRenderGraph" class="graph-empty-state">
      <span>{{ graphEmptyText }}</span>
    </div>

    <div class="graph-tooltip" v-if="hoveredNode" :style="tooltipStyle">
      <div class="tooltip-label">{{ hoveredNode.label }}</div>
      <div class="tooltip-meta">
        <span>链接: {{ hoveredNode.linkCount }}</span>
        <span v-if="hoveredNode.isOrphan" class="tooltip-orphan">孤立笔记</span>
      </div>
      <div class="tooltip-tags" v-if="hoveredNode.tags.length">
        <span class="tooltip-tag" v-for="tag in hoveredNode.tags.slice(0, 3)" :key="tag">#{{ tag }}</span>
      </div>
    </div>

    <div class="graph-stats">
      <span class="stat-item">节点: {{ visibleGraphData.stats.totalNodes }}</span>
      <span class="stat-item">链接: {{ visibleGraphData.stats.totalEdges }}</span>
      <span class="stat-item stat-orphan" v-if="visibleGraphData.stats.orphanCount > 0">
        孤立: {{ visibleGraphData.stats.orphanCount }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useKnowledgeGraph } from '@/composables/useKnowledgeGraph'
import type { KnowledgeGraphData, GraphEdge, GraphNode } from '@/types'

const props = defineProps<{
  graphData: KnowledgeGraphData
  currentFile?: string
}>()

const emit = defineEmits<{
  (e: 'nodeClick', node: GraphNode): void
}>()

const graphContainer = ref<HTMLElement | null>(null)
const searchQuery = ref('')
const graphMode = ref<'global' | 'current'>('global')
const mousePos = ref({ x: 0, y: 0 })
let graphRenderVersion = 0
let isDisposed = false

const { initGraph, hoveredNode, focusNode, destroyGraph } = useKnowledgeGraph(
  graphContainer,
  (node) => emit('nodeClick', node)
)

const tooltipStyle = computed(() => ({
  left: `${mousePos.value.x + 12}px`,
  top: `${mousePos.value.y - 8}px`
}))

const hasSearchQuery = computed(() => searchQuery.value.trim().length > 0)

const getEdgeSourceId = (edge: GraphEdge): string => typeof edge.source === 'string' ? edge.source : edge.source.id
const getEdgeTargetId = (edge: GraphEdge): string => typeof edge.target === 'string' ? edge.target : edge.target.id

const buildStats = (nodes: GraphNode[], edges: GraphEdge[]) => ({
  totalNodes: nodes.length,
  totalEdges: edges.length,
  orphanCount: nodes.filter(node => node.isOrphan).length,
  avgLinkCount: nodes.length
    ? Math.round((nodes.reduce((sum, node) => sum + node.linkCount, 0) / nodes.length) * 10) / 10
    : 0,
})

const currentNode = computed(() => (
  props.currentFile
    ? props.graphData.nodes.find(node => node.path === props.currentFile)
    : undefined
))

const localGraphData = computed<KnowledgeGraphData>(() => {
  if (!props.currentFile || !currentNode.value) {
    return {
      nodes: [],
      edges: [],
      stats: buildStats([], []),
    }
  }

  const visibleIds = new Set<string>([props.currentFile])
  props.graphData.edges.forEach(edge => {
    const source = getEdgeSourceId(edge)
    const target = getEdgeTargetId(edge)
    if (source === props.currentFile) visibleIds.add(target)
    if (target === props.currentFile) visibleIds.add(source)
  })

  const nodes = props.graphData.nodes
    .filter(node => visibleIds.has(node.id))
    .map(node => ({ ...node }))
  const edges = props.graphData.edges
    .filter(edge => visibleIds.has(getEdgeSourceId(edge)) && visibleIds.has(getEdgeTargetId(edge)))
    .map(edge => ({
      source: getEdgeSourceId(edge),
      target: getEdgeTargetId(edge),
      weight: edge.weight,
    }))

  const localLinkCount = new Map(nodes.map(node => [node.id, 0]))
  edges.forEach(edge => {
    const source = getEdgeSourceId(edge)
    const target = getEdgeTargetId(edge)
    localLinkCount.set(source, (localLinkCount.get(source) || 0) + 1)
    localLinkCount.set(target, (localLinkCount.get(target) || 0) + 1)
  })
  nodes.forEach(node => {
    node.linkCount = localLinkCount.get(node.id) || 0
    node.isOrphan = node.linkCount === 0
  })

  return {
    nodes,
    edges,
    stats: buildStats(nodes, edges),
  }
})

const visibleGraphData = computed(() => graphMode.value === 'current' ? localGraphData.value : props.graphData)
const canRenderGraph = computed(() => visibleGraphData.value.nodes.length > 0)
const currentNeighborCount = computed(() => Math.max(0, visibleGraphData.value.nodes.length - 1))
const currentFocusLabel = computed(() => currentNode.value?.label || '未选择当前笔记')
const graphEmptyText = computed(() => (
  graphMode.value === 'current'
    ? '当前笔记还没有进入知识图谱'
    : '暂无可展示的图谱数据'
))

const searchResults = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return []
  return visibleGraphData.value.nodes
    .filter(node => {
      const haystack = [
        node.label,
        node.id,
        node.path,
        ...node.tags.map(tag => `#${tag}`),
      ].join(' ').toLowerCase()
      return haystack.includes(q)
    })
    .slice(0, 6)
})

const buildGraph = () => {
  const version = ++graphRenderVersion
  nextTick(() => {
    if (isDisposed || version !== graphRenderVersion) return
    if (!canRenderGraph.value) {
      destroyGraph()
      return
    }
    initGraph(visibleGraphData.value)
  })
}

const handleSearch = () => {
  const match = searchResults.value[0]
  if (match) focusNode(match.id)
}

const openNode = (node: GraphNode) => {
  focusNode(node.id)
  emit('nodeClick', node)
}

const openFirstSearchResult = () => {
  const match = searchResults.value[0]
  if (match) openNode(match)
}

const clearSearch = () => {
  searchQuery.value = ''
}

const handleRefresh = () => {
  destroyGraph()
  buildGraph()
}

const handleGraphMouseMove = (event: MouseEvent) => {
  const rect = graphContainer.value?.getBoundingClientRect()
  if (rect) {
    mousePos.value = { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }
}

watch(visibleGraphData, () => {
  destroyGraph()
  buildGraph()
}, { deep: true })

onMounted(() => {
  buildGraph()
  graphContainer.value?.addEventListener('mousemove', handleGraphMouseMove)
})

onBeforeUnmount(() => {
  isDisposed = true
  graphRenderVersion++
  graphContainer.value?.removeEventListener('mousemove', handleGraphMouseMove)
  destroyGraph()
})
</script>

<style scoped>
.knowledge-graph {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

.graph-toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
}

.toolbar-search {
  flex: 1;
  display: flex;
  align-items: center;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: var(--space-1) var(--space-2);
  gap: var(--space-2);
  transition: all var(--duration-fast) var(--ease-default);
}

.toolbar-search:focus-within {
  border-color: var(--accent-primary);
  box-shadow: var(--shadow-glow);
}

.toolbar-search svg {
  color: var(--text-muted);
  flex-shrink: 0;
}

.toolbar-search-input {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: 12px;
  outline: none;
  font-family: var(--font-sans);
  min-width: 0;
}

.toolbar-search-input::placeholder {
  color: var(--text-muted);
}

.toolbar-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  color: var(--text-muted);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-default);
  flex-shrink: 0;
}

.toolbar-btn:hover {
  color: var(--accent-primary);
  border-color: var(--accent-primary);
}

.graph-mode-toggle {
  display: flex;
  align-items: center;
  min-height: 28px;
  padding: 2px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  flex-shrink: 0;
}

.mode-btn {
  min-width: 42px;
  min-height: 24px;
  padding: 0 8px;
  border: none;
  border-radius: calc(var(--radius-md) - 2px);
  background: transparent;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 600;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: color var(--duration-fast) var(--ease-default), background var(--duration-fast) var(--ease-default);
}

.mode-btn:hover,
.mode-btn:focus-visible {
  color: var(--text-primary);
  outline: none;
}

.mode-btn.active {
  background: var(--accent-soft);
  color: var(--accent-primary);
}

.graph-focus-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 32px;
  padding: 7px 12px;
  border-bottom: 1px solid var(--border-subtle);
  background: color-mix(in srgb, var(--accent-soft) 42%, transparent);
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.3;
  flex-shrink: 0;
}

.focus-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary);
  font-weight: 600;
}

.graph-canvas {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.graph-empty-state {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  color: var(--text-muted);
  font-size: 12px;
  text-align: center;
}

.graph-search-results {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  border-bottom: 1px solid var(--border-subtle);
  background: color-mix(in srgb, var(--bg-surface) 82%, transparent);
  flex-shrink: 0;
}

.graph-search-result {
  width: 100%;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 8px;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  text-align: left;
  transition: background var(--duration-fast) var(--ease-default), border-color var(--duration-fast) var(--ease-default);
}

.graph-search-result:hover,
.graph-search-result:focus-visible {
  background: var(--bg-hover);
  border-color: var(--border-default);
  outline: none;
}

.result-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.result-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.3;
}

.result-path {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 10px;
  color: var(--text-muted);
  line-height: 1.3;
}

.result-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  flex-shrink: 0;
  font-size: 10px;
  color: var(--text-muted);
  line-height: 1.3;
}

.graph-search-empty {
  padding: 8px;
  color: var(--text-muted);
  font-size: 12px;
  text-align: center;
}

.graph-canvas :deep(svg) {
  display: block;
}

.graph-tooltip {
  position: absolute;
  pointer-events: none;
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  box-shadow: var(--shadow-lg);
  z-index: 30;
  max-width: 200px;
}

.tooltip-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--space-1);
}

.tooltip-meta {
  display: flex;
  gap: var(--space-2);
  font-size: 10px;
  color: var(--text-muted);
}

.tooltip-orphan {
  color: var(--error);
  font-weight: 600;
}

.tooltip-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  margin-top: var(--space-1);
}

.tooltip-tag {
  font-size: 9px;
  padding: 1px 6px;
  background: var(--accent-soft);
  color: var(--accent-primary);
  border-radius: 8px;
}

.graph-stats {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-top: 1px solid var(--border-subtle);
  font-size: 10px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.stat-orphan {
  color: var(--error);
}
</style>
