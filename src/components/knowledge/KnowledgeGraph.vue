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
          @input="handleSearch"
        />
      </div>
      <button class="toolbar-btn" @click="handleRefresh" title="刷新图谱">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
      </button>
    </div>

    <div ref="graphContainer" class="graph-canvas"></div>

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
      <span class="stat-item">节点: {{ graphData.stats.totalNodes }}</span>
      <span class="stat-item">链接: {{ graphData.stats.totalEdges }}</span>
      <span class="stat-item stat-orphan" v-if="graphData.stats.orphanCount > 0">
        孤立: {{ graphData.stats.orphanCount }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useKnowledgeGraph } from '@/composables/useKnowledgeGraph'
import type { KnowledgeGraphData, GraphNode } from '@/types'

const props = defineProps<{
  graphData: KnowledgeGraphData
}>()

const emit = defineEmits<{
  (e: 'nodeClick', node: GraphNode): void
}>()

const graphContainer = ref<HTMLElement | null>(null)
const searchQuery = ref('')
const mousePos = ref({ x: 0, y: 0 })

const { initGraph, hoveredNode, focusNode, destroyGraph } = useKnowledgeGraph(graphContainer)

const tooltipStyle = computed(() => ({
  left: `${mousePos.value.x + 12}px`,
  top: `${mousePos.value.y - 8}px`
}))

const buildGraph = () => {
  nextTick(() => {
    initGraph(props.graphData)
    attachNodeClickHandler()
  })
}

const attachNodeClickHandler = () => {
  if (!graphContainer.value) return
  const nodeEls = graphContainer.value.querySelectorAll('g[cursor="pointer"]')
  const nodes = props.graphData.nodes
  nodeEls.forEach((el, i) => {
    if (nodes[i]) {
      el.addEventListener('click', () => {
        emit('nodeClick', nodes[i])
      })
    }
  })
}

const handleSearch = () => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return
  const match = props.graphData.nodes.find(n =>
    n.label.toLowerCase().includes(q) || n.id.toLowerCase().includes(q)
  )
  if (match) {
    focusNode(match.id)
  }
}

const handleRefresh = () => {
  destroyGraph()
  buildGraph()
}

watch(() => props.graphData, () => {
  destroyGraph()
  buildGraph()
}, { deep: true })

onMounted(() => {
  buildGraph()
  if (graphContainer.value) {
    graphContainer.value.addEventListener('mousemove', (e) => {
      const rect = graphContainer.value?.getBoundingClientRect()
      if (rect) {
        mousePos.value = { x: e.clientX - rect.left, y: e.clientY - rect.top }
      }
    })
  }
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

.graph-canvas {
  flex: 1;
  min-height: 0;
  overflow: hidden;
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
