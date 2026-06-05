<template>
  <div class="chart-renderer" ref="chartContainer">
    <div class="chart-header">
      <span class="chart-type-badge">{{ chartType }}</span>
      <div class="chart-actions">
        <button
          type="button"
          class="chart-btn"
          @click="toggleSource"
          :title="showSource ? '隐藏源码' : '查看源码'"
          :aria-label="showSource ? '隐藏图表源码' : '查看图表源码'"
          :aria-pressed="showSource"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
        </button>
        <button
          type="button"
          class="chart-btn"
          @click="regenerateChart"
          title="重新生成"
          aria-label="重新生成图表"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
        </button>
      </div>
    </div>
    <div v-if="showSource" class="chart-source">
      <pre><code>{{ mermaidSource }}</code></pre>
    </div>
    <div v-else class="chart-preview" ref="previewContainer"></div>
  </div>
</template>

<script lang="ts">
let chartInstanceCounter = 0
</script>

<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted, watch } from 'vue'
import { sanitizeSvg } from '@/utils/security'

const props = defineProps<{
  mermaidSource: string
}>()

const emit = defineEmits<{
  (e: 'regenerate'): void
}>()

const chartContainer = ref<HTMLElement>()
const previewContainer = ref<HTMLElement>()
const showSource = ref(false)
const chartType = ref('chart')
let renderVersion = 0
const chartInstanceId = ++chartInstanceCounter

onMounted(() => {
  detectChartType()
  renderChart()
})

watch(() => props.mermaidSource, () => {
  detectChartType()
  renderChart()
})

watch(showSource, (visible) => {
  if (!visible) renderChart()
}, { flush: 'post' })

onUnmounted(() => {
  renderVersion += 1
})

function detectChartType() {
  const src = props.mermaidSource.trim().toLowerCase()
  if (src.startsWith('graph') || src.startsWith('flowchart')) chartType.value = '流程图'
  else if (src.startsWith('sequence')) chartType.value = '时序图'
  else if (src.startsWith('class')) chartType.value = '类图'
  else if (src.startsWith('gantt')) chartType.value = '甘特图'
  else if (src.startsWith('pie')) chartType.value = '饼图'
  else if (src.startsWith('er')) chartType.value = 'ER图'
  else chartType.value = '图表'
}

async function renderChart() {
  const currentVersion = ++renderVersion
  await nextTick()
  const container = previewContainer.value
  if (!container) return
  const source = props.mermaidSource
  container.textContent = ''
  try {
    const mermaid = (await import('mermaid')).default
    if (currentVersion !== renderVersion || previewContainer.value !== container) return
    mermaid.initialize({ startOnLoad: false, theme: 'dark' })
    const { svg } = await mermaid.render(`chart-${chartInstanceId}-${currentVersion}`, source)
    if (currentVersion !== renderVersion || previewContainer.value !== container) return
    container.innerHTML = sanitizeSvg(svg)
  } catch (e) {
    if (currentVersion !== renderVersion || previewContainer.value !== container) return
    const errorEl = document.createElement('div')
    errorEl.style.color = 'var(--accent-red)'
    errorEl.style.fontSize = '12px'
    errorEl.style.padding = '8px'
    errorEl.textContent = `图表渲染失败: ${e instanceof Error ? e.message : String(e)}`
    container.appendChild(errorEl)
  }
}

function toggleSource() {
  showSource.value = !showSource.value
}

function regenerateChart() {
  emit('regenerate')
}
</script>

<style scoped>
.chart-renderer {
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  overflow: hidden;
  margin: 8px 0;
}
.chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-elevated);
}
.chart-type-badge {
  font-size: 11px;
  font-weight: 600;
  color: var(--accent-primary);
  background: var(--accent-soft);
  padding: 2px 8px;
  border-radius: var(--radius-xs);
}
.chart-actions {
  display: flex;
  gap: 4px;
}
.chart-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: var(--radius-xs);
  display: flex;
  align-items: center;
}
.chart-btn:hover { color: var(--text-primary); background: var(--bg-hover); }
.chart-btn:focus-visible {
  outline: 2px solid var(--accent-primary);
  outline-offset: 2px;
}
.chart-source {
  padding: 12px;
  overflow-x: auto;
}
.chart-source pre {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-secondary);
}
.chart-preview {
  padding: 16px;
  display: flex;
  justify-content: center;
  min-height: 100px;
}
.chart-preview :deep(svg) {
  max-width: 100%;
  height: auto;
}
</style>
