# 知识图谱可视化 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 AI Native Markdown Editor 添加交互式知识图谱可视化功能，帮助用户直观探索笔记关联关系。

**Architecture:** 在现有 `knowledge` 模块基础上，使用 D3.js v7 力导向图渲染知识图谱。新增 `useKnowledgeGraph` composable 封装 D3 逻辑，新增 `KnowledgeGraph.vue` 组件渲染图谱，在 `Sidebar.vue` 中添加"图谱"Tab 页集成。

**Tech Stack:** Vue 3 + TypeScript + D3.js v7 + Pinia + CSS Variables（复用现有主题系统）

---

## 文件结构

| 操作 | 文件路径 | 职责 |
|------|----------|------|
| 修改 | `package.json` | 添加 d3 和 @types/d3 依赖 |
| 修改 | `src/types/index.ts` | 添加 GraphNode、GraphEdge、KnowledgeGraph 类型 |
| 修改 | `src/utils/knowledge.ts` | 添加 buildKnowledgeGraph 函数 |
| 创建 | `src/composables/useKnowledgeGraph.ts` | 封装 D3 力导向图逻辑 |
| 创建 | `src/components/knowledge/KnowledgeGraph.vue` | 图谱可视化组件 |
| 修改 | `src/components/knowledge/index.ts` | 导出 KnowledgeGraph 组件 |
| 修改 | `src/components/Sidebar.vue` | 添加"图谱"Tab 和面板 |

---

### Task 1: 安装 D3.js 依赖

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 安装 d3 和类型声明**

Run: `npm install d3 && npm install --save-dev @types/d3`

Expected: `package.json` 中新增 `"d3": "^7.x"` 和 `"@types/d3": "^7.x"`

- [ ] **Step 2: 验证安装**

Run: `npm ls d3`

Expected: 输出 `d3@7.x.x`，无错误

---

### Task 2: 添加图谱数据类型

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: 在 `src/types/index.ts` 文件末尾添加图谱类型定义**

在文件末尾追加：

```typescript
export interface GraphNode {
  id: string
  label: string
  path: string
  linkCount: number
  tags: string[]
  isOrphan: boolean
  x?: number
  y?: number
  fx?: number | null
  fy?: number | null
}

export interface GraphEdge {
  source: string | GraphNode
  target: string | GraphNode
  weight: number
}

export interface KnowledgeGraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
  stats: {
    totalNodes: number
    totalEdges: number
    orphanCount: number
    avgLinkCount: number
  }
}
```

- [ ] **Step 2: 验证类型无报错**

Run: `npx vue-tsc --noEmit 2>&1 | head -20`

Expected: 无新增类型错误

---

### Task 3: 扩展 knowledge 工具函数

**Files:**
- Modify: `src/utils/knowledge.ts`

- [ ] **Step 1: 在 `src/utils/knowledge.ts` 末尾添加 buildKnowledgeGraph 函数**

在文件末尾追加：

```typescript
import type { GraphNode, GraphEdge, KnowledgeGraphData } from '@/types'

export function buildKnowledgeGraph(
  files: { path: string; content: string }[]
): KnowledgeGraphData {
  const graph = buildLinkGraph(files)
  const tagMap = getAllTags(files)

  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []

  for (const file of files) {
    const name = file.path.split('/').pop()?.replace(/\.md$/, '') || ''
    const outgoingCount = graph.get(file.path)?.size || 0
    let incomingCount = 0
    for (const targets of graph.values()) {
      if (targets.has(file.path)) incomingCount++
    }
    const linkCount = outgoingCount + incomingCount

    nodes.push({
      id: file.path,
      label: name,
      path: file.path,
      linkCount,
      tags: [...new Set(
        extractTags(file.content).map(t => t.name)
      )],
      isOrphan: linkCount === 0
    })
  }

  for (const [source, targets] of graph) {
    for (const target of targets) {
      edges.push({ source, target, weight: 1 })
    }
  }

  return {
    nodes,
    edges,
    stats: {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      orphanCount: nodes.filter(n => n.isOrphan).length,
      avgLinkCount: nodes.length > 0
        ? Math.round((nodes.reduce((s, n) => s + n.linkCount, 0) / nodes.length) * 10) / 10
        : 0
    }
  }
}
```

- [ ] **Step 2: 验证编译通过**

Run: `npx vue-tsc --noEmit 2>&1 | head -20`

Expected: 无新增错误

---

### Task 4: 创建 useKnowledgeGraph composable

**Files:**
- Create: `src/composables/useKnowledgeGraph.ts`

- [ ] **Step 1: 创建 `src/composables/useKnowledgeGraph.ts`**

```typescript
import { ref, onUnmounted, type Ref } from 'vue'
import * as d3 from 'd3'
import type { GraphNode, GraphEdge, KnowledgeGraphData } from '@/types'

type SimulationNode = GraphNode & d3.SimulationNodeDatum
type SimulationEdge = d3.SimulationLinkDatum<SimulationNode>

export function useKnowledgeGraph(container: Ref<HTMLElement | null>) {
  const simulation = ref<d3.Simulation<SimulationNode, SimulationEdge> | null>(null)
  const svg = ref<d3.Selection<SVGSVGElement, unknown, null, undefined> | null>(null)
  const hoveredNode = ref<SimulationNode | null>(null)
  const selectedNode = ref<SimulationNode | null>(null)

  const TAG_COLORS = [
    '#89b4fa', '#a6e3a1', '#f9e2af', '#f38ba8', '#cba6f7',
    '#94e2d5', '#fab387', '#74c7ec', '#f5c2e7', '#eba0ac'
  ]

  function getNodeRadius(linkCount: number): number {
    return Math.sqrt(linkCount + 1) * 5 + 8
  }

  function getTagColor(tags: string[]): string {
    if (tags.length === 0) return '#6c7086'
    const index = tags[0].charCodeAt(0) % TAG_COLORS.length
    return TAG_COLORS[index]
  }

  function initGraph(data: KnowledgeGraphData) {
    if (!container.value) return
    destroyGraph()

    const width = container.value.clientWidth
    const height = container.value.clientHeight

    const simNodes: SimulationNode[] = data.nodes.map(n => ({ ...n }))
    const simEdges: SimulationEdge[] = data.edges.map(e => ({
      source: e.source as string,
      target: e.target as string,
      weight: e.weight
    }))

    const svgEl = d3.select(container.value)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .style('background', 'transparent')

    svg.value = svgEl

    const g = svgEl.append('g')

    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 5])
      .on('zoom', (event) => {
        g.attr('transform', event.transform.toString())
      })

    svgEl.call(zoomBehavior)

    const edgeGroup = g.append('g').attr('class', 'edges')
    const nodeGroup = g.append('g').attr('class', 'nodes')

    const edgeSelection = edgeGroup
      .selectAll('line')
      .data(simEdges)
      .join('line')
      .attr('stroke', 'var(--text-muted)')
      .attr('stroke-opacity', 0.4)
      .attr('stroke-width', 1.5)

    const nodeSelection = nodeGroup
      .selectAll<SVGGElement, SimulationNode>('g')
      .data(simNodes)
      .join('g')
      .attr('cursor', 'pointer')
      .call(d3.drag<SVGGElement, SimulationNode>()
        .on('start', (event, d) => {
          if (!event.active) simulation.value?.alphaTarget(0.3).restart()
          d.fx = d.x
          d.fy = d.y
        })
        .on('drag', (event, d) => {
          d.fx = event.x
          d.fy = event.y
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.value?.alphaTarget(0)
          d.fx = null
          d.fy = null
        })
      )

    nodeSelection
      .append('circle')
      .attr('r', d => getNodeRadius(d.linkCount))
      .attr('fill', d => getTagColor(d.tags))
      .attr('stroke', d => d.isOrphan ? '#f38ba8' : 'var(--bg-elevated)')
      .attr('stroke-width', d => d.isOrphan ? 2.5 : 1.5)
      .attr('stroke-dasharray', d => d.isOrphan ? '4,3' : 'none')

    nodeSelection
      .append('text')
      .text(d => d.label.length > 12 ? d.label.slice(0, 11) + '…' : d.label)
      .attr('dy', d => getNodeRadius(d.linkCount) + 14)
      .attr('text-anchor', 'middle')
      .attr('fill', 'var(--text-secondary)')
      .attr('font-size', '10px')
      .attr('font-family', 'var(--font-sans)')
      .attr('pointer-events', 'none')

    nodeSelection
      .on('mouseenter', (event, d) => {
        hoveredNode.value = d
        d3.select(event.currentTarget).select('circle')
          .transition().duration(150)
          .attr('stroke', 'var(--accent-primary)')
          .attr('stroke-width', 3)
        edgeSelection
          .attr('stroke-opacity', e => {
            const src = typeof e.source === 'string' ? e.source : (e.source as SimulationNode).id
            const tgt = typeof e.target === 'string' ? e.target : (e.target as SimulationNode).id
            return src === d.id || tgt === d.id ? 0.8 : 0.1
          })
          .attr('stroke', e => {
            const src = typeof e.source === 'string' ? e.source : (e.source as SimulationNode).id
            const tgt = typeof e.target === 'string' ? e.target : (e.target as SimulationNode).id
            return src === d.id || tgt === d.id ? 'var(--accent-primary)' : 'var(--text-muted)'
          })
      })
      .on('mouseleave', (event, d) => {
        hoveredNode.value = null
        d3.select(event.currentTarget).select('circle')
          .transition().duration(150)
          .attr('stroke', d.isOrphan ? '#f38ba8' : 'var(--bg-elevated)')
          .attr('stroke-width', d.isOrphan ? 2.5 : 1.5)
        edgeSelection
          .attr('stroke-opacity', 0.4)
          .attr('stroke', 'var(--text-muted)')
      })

    const sim = d3.forceSimulation<SimulationNode>(simNodes)
      .force('link', d3.forceLink<SimulationNode, SimulationEdge>(simEdges)
        .id(d => d.id)
        .distance(80)
      )
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<SimulationNode>().radius(d => getNodeRadius(d.linkCount) + 4))
      .on('tick', () => {
        edgeSelection
          .attr('x1', d => (d.source as SimulationNode).x ?? 0)
          .attr('y1', d => (d.source as SimulationNode).y ?? 0)
          .attr('x2', d => (d.target as SimulationNode).x ?? 0)
          .attr('y2', d => (d.target as SimulationNode).y ?? 0)

        nodeSelection.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`)
      })

    simulation.value = sim
  }

  function highlightNode(nodeId: string) {
    if (!svg.value) return
    svg.value.selectAll<SVGGElement, SimulationNode>('g.node, g')
      .filter(d => d.id === nodeId)
      .select('circle')
      .transition().duration(200)
      .attr('stroke', 'var(--accent-primary)')
      .attr('stroke-width', 4)
  }

  function focusNode(nodeId: string) {
    if (!svg.value || !simulation.value) return
    const nodes = simulation.value.nodes()
    const target = nodes.find(n => n.id === nodeId)
    if (!target || target.x == null || target.y == null) return

    const width = container.value?.clientWidth ?? 600
    const height = container.value?.clientHeight ?? 400

    svg.value.transition().duration(500).call(
      d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.2, 5]).on('zoom', (event) => {
        svg.value?.select('g').attr('transform', event.transform.toString())
      }).transform,
      d3.zoomIdentity.translate(width / 2, height / 2).scale(1.5).translate(-target.x, -target.y)
    )
  }

  function destroyGraph() {
    if (simulation.value) {
      simulation.value.stop()
      simulation.value = null
    }
    if (container.value) {
      d3.select(container.value).selectAll('svg').remove()
    }
    svg.value = null
    hoveredNode.value = null
    selectedNode.value = null
  }

  onUnmounted(() => {
    destroyGraph()
  })

  return {
    simulation,
    hoveredNode,
    selectedNode,
    initGraph,
    highlightNode,
    focusNode,
    destroyGraph
  }
}
```

- [ ] **Step 2: 在 `src/composables/index.ts` 中导出**

在文件末尾追加：

```typescript
export { useKnowledgeGraph } from './useKnowledgeGraph'
```

- [ ] **Step 3: 验证编译通过**

Run: `npx vue-tsc --noEmit 2>&1 | head -20`

Expected: 无新增错误

---

### Task 5: 创建 KnowledgeGraph.vue 组件

**Files:**
- Create: `src/components/knowledge/KnowledgeGraph.vue`

- [ ] **Step 1: 创建 `src/components/knowledge/KnowledgeGraph.vue`**

```vue
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
      <span class="stat-item">节点: {{ graphData?.stats.totalNodes ?? 0 }}</span>
      <span class="stat-item">链接: {{ graphData?.stats.totalEdges ?? 0 }}</span>
      <span class="stat-item stat-orphan" v-if="(graphData?.stats.orphanCount ?? 0) > 0">
        孤立: {{ graphData?.stats.orphanCount }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useKnowledgeGraph } from '@/composables/useKnowledgeGraph'
import { buildKnowledgeGraph } from '@/utils/knowledge'
import type { KnowledgeGraphData, GraphNode } from '@/types'

const props = defineProps<{
  files: { path: string; content: string }[]
}>()

const emit = defineEmits<{
  (e: 'nodeClick', node: GraphNode): void
}>()

const graphContainer = ref<HTMLElement | null>(null)
const searchQuery = ref('')
const graphData = ref<KnowledgeGraphData | null>(null)
const mousePos = ref({ x: 0, y: 0 })

const { initGraph, hoveredNode, focusNode, destroyGraph } = useKnowledgeGraph(graphContainer)

const tooltipStyle = computed(() => ({
  left: `${mousePos.value.x + 12}px`,
  top: `${mousePos.value.y - 8}px`
}))

const buildGraph = () => {
  if (!props.files.length) return
  graphData.value = buildKnowledgeGraph(props.files)
  nextTick(() => {
    if (graphData.value) {
      initGraph(graphData.value)
      attachNodeClickHandler()
    }
  })
}

const attachNodeClickHandler = () => {
  if (!graphContainer.value) return
  const nodeEls = graphContainer.value.querySelectorAll('g[cursor="pointer"]')
  const nodes = graphData.value?.nodes ?? []
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
  if (!q || !graphContainer.value) return
  focusNode(q)
}

const handleRefresh = () => {
  destroyGraph()
  buildGraph()
}

watch(() => props.files, () => {
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
```

- [ ] **Step 2: 验证编译通过**

Run: `npx vue-tsc --noEmit 2>&1 | head -20`

Expected: 无新增错误

---

### Task 6: 更新 knowledge 模块导出

**Files:**
- Modify: `src/components/knowledge/index.ts`

- [ ] **Step 1: 在 `src/components/knowledge/index.ts` 中添加 KnowledgeGraph 导出**

将文件内容替换为：

```typescript
export { default as WikiLink } from './WikiLink.vue'
export { default as TagBadge } from './TagBadge.vue'
export { default as KnowledgeGraph } from './KnowledgeGraph.vue'
```

- [ ] **Step 2: 验证编译通过**

Run: `npx vue-tsc --noEmit 2>&1 | head -20`

Expected: 无新增错误

---

### Task 7: 在 Sidebar 中集成图谱 Tab

**Files:**
- Modify: `src/components/Sidebar.vue`

- [ ] **Step 1: 在 Sidebar.vue 的 `<script setup>` 区域添加导入和图谱数据逻辑**

在 `import FileTreeNode from './FileTreeNode.vue'` 之后添加：

```typescript
import { KnowledgeGraph } from './knowledge'
import { buildKnowledgeGraph } from '../utils/knowledge'
import type { KnowledgeGraphData, GraphNode } from '../types'
```

将 `activeTab` 的类型从 `'files' | 'ai' | 'settings'` 改为 `'files' | 'graph' | 'ai' | 'settings'`：

```typescript
const activeTab = ref<'files' | 'graph' | 'ai' | 'settings'>('files')
```

在 `const toggleTheme = () => { emit('toggle-theme') }` 之前添加图谱相关逻辑：

```typescript
const graphData = ref<KnowledgeGraphData | null>(null)
const graphLoading = ref(false)

const loadGraphData = async () => {
  if (!rootPath.value || !isTauri) return
  graphLoading.value = true
  try {
    const allFiles: { path: string; content: string }[] = []
    const collectFiles = async (dirPath: string) => {
      const entries = await invoke('read_dir', { path: dirPath }) as any[]
      for (const entry of entries) {
        if (entry.is_dir) {
          await collectFiles(entry.path)
        } else if (entry.name.endsWith('.md') || entry.name.endsWith('.markdown')) {
          const content = await invoke('read_file', { path: entry.path }) as string
          allFiles.push({ path: entry.path, content })
        }
      }
    }
    await collectFiles(rootPath.value)
    graphData.value = buildKnowledgeGraph(allFiles)
  } catch (error) {
    console.error('加载图谱数据失败:', error)
  } finally {
    graphLoading.value = false
  }
}

const handleGraphNodeClick = (node: GraphNode) => {
  handleSelect(node.path)
}

watch(activeTab, (tab) => {
  if (tab === 'graph' && !graphData.value) {
    loadGraphData()
  }
})
```

在 `import` 区域添加 `watch`：

将 `import { ref, computed, onMounted, nextTick } from 'vue'` 改为 `import { ref, computed, onMounted, nextTick, watch } from 'vue'`

- [ ] **Step 2: 在 Sidebar.vue 的 `<template>` 中添加图谱导航按钮和面板**

在 `sidebar-nav` 区域，在 AI 按钮之前添加图谱按钮：

```html
<button class="nav-btn" :class="{ active: activeTab === 'graph' }" @click="activeTab = 'graph'" title="知识图谱">
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="2"/><circle cx="6" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/><line x1="12" y1="10" x2="7.5" y2="7.5"/><line x1="12" y1="10" x2="16.5" y2="7.5"/><line x1="12" y1="14" x2="7.5" y2="16.5"/><line x1="12" y1="14" x2="16.5" y2="16.5"/></svg>
</button>
```

在 `sidebar-content` 的 `<Transition>` 内，在 AI 配置面板的 `v-else-if` 之前添加图谱面板：

```html
<div v-else-if="activeTab === 'graph'" class="panel panel-graph">
  <div class="panel-header">
    <span class="panel-title">知识图谱</span>
  </div>
  <div class="graph-panel-content" v-if="rootPath">
    <KnowledgeGraph
      v-if="graphData"
      :files="[]"
      @node-click="handleGraphNodeClick"
    />
    <div class="graph-loading" v-else-if="graphLoading">
      <span class="mini-spinner"></span>
      <span>加载中...</span>
    </div>
  </div>
  <div class="empty-prompt" v-else>
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5"><circle cx="12" cy="12" r="2"/><circle cx="6" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><line x1="12" y1="10" x2="7.5" y2="7.5"/><line x1="12" y1="10" x2="16.5" y2="7.5"/></svg>
    <p class="empty-title">打开工作区</p>
    <p class="empty-desc">打开文件夹后可查看知识图谱</p>
  </div>
</div>
```

- [ ] **Step 3: 在 Sidebar.vue 的 `<style scoped>` 中添加图谱面板样式**

在 `</style>` 之前追加：

```css
.panel-graph {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.graph-panel-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.graph-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-8);
  color: var(--text-muted);
  font-size: 12px;
}
```

- [ ] **Step 4: 修复 KnowledgeGraph 组件的 files prop 传递**

由于 `loadGraphData` 已经将数据构建为 `graphData`，KnowledgeGraph 组件需要接收 `graphData` 而非 `files`。更新 Task 5 中 KnowledgeGraph.vue 的 props：

将 props 从 `files: { path: string; content: string }[]` 改为 `graphData: KnowledgeGraphData`，并移除组件内部的 `buildKnowledgeGraph` 调用，直接使用传入的 `graphData`。

在 Sidebar.vue 中更新传参：

```html
<KnowledgeGraph
  v-if="graphData"
  :graph-data="graphData"
  @node-click="handleGraphNodeClick"
/>
```

- [ ] **Step 5: 验证编译通过**

Run: `npx vue-tsc --noEmit 2>&1 | head -20`

Expected: 无新增错误

---

### Task 8: 修复 KnowledgeGraph.vue 以接受 graphData prop

**Files:**
- Modify: `src/components/knowledge/KnowledgeGraph.vue`

- [ ] **Step 1: 更新 props 和内部逻辑**

将 `props` 定义从：

```typescript
const props = defineProps<{
  files: { path: string; content: string }[]
}>()
```

改为：

```typescript
const props = defineProps<{
  graphData: KnowledgeGraphData
}>()
```

将 `graphData` ref 删除（不再需要内部状态），直接使用 `props.graphData`。

将 `buildGraph` 函数改为：

```typescript
const buildGraph = () => {
  nextTick(() => {
    initGraph(props.graphData)
    attachNodeClickHandler()
  })
}
```

将 `watch` 改为：

```typescript
watch(() => props.graphData, () => {
  destroyGraph()
  buildGraph()
}, { deep: true })
```

更新 `handleRefresh`：

```typescript
const handleRefresh = () => {
  destroyGraph()
  buildGraph()
}
```

更新模板中的统计显示，将 `graphData?.stats` 改为 `graphData.stats`（因为 graphData 现在是必需 prop）。

- [ ] **Step 2: 验证编译通过**

Run: `npx vue-tsc --noEmit 2>&1 | head -20`

Expected: 无新增错误

---

### Task 9: 构建验证与最终测试

**Files:**
- All modified files

- [ ] **Step 1: 运行完整构建**

Run: `npm run build`

Expected: 构建成功，无错误

- [ ] **Step 2: 运行开发服务器验证**

Run: `npm run dev`

Expected: 开发服务器启动成功，可在浏览器中访问

- [ ] **Step 3: 提交代码**

```bash
git add -A
git commit -m "feat: add knowledge graph visualization with D3.js force-directed layout"
```
