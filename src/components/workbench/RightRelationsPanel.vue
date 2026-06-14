<template>
  <div class="right-relations-panel">
    <div class="relation-stats">
      <span><strong>{{ graphStats.totalNodes }}</strong> 笔记</span>
      <span><strong>{{ graphStats.totalEdges }}</strong> 链接</span>
      <span><strong>{{ graphStats.orphanCount }}</strong> 孤立</span>
    </div>

    <div v-if="currentRecord" class="relation-current">
      <div class="relation-current-title">{{ currentRecord.title }}</div>
      <div class="relation-current-path">{{ currentRecord.filePath }}</div>
    </div>
    <div v-else class="relation-empty">打开 Markdown 文件后查看关联</div>

    <section v-if="currentRecord?.links.length" class="relation-section">
      <div class="relation-section-title">出链</div>
      <button
        v-for="link in currentRecord.links"
        :key="link"
        type="button"
        class="dock-link-chip"
        @click="$emit('wiki-navigate', link)"
      >
        [[{{ link }}]]
      </button>
    </section>

    <section class="relation-section">
      <div class="relation-section-title">反链 {{ backlinks.length }}</div>
      <button
        v-for="item in backlinks"
        :key="`backlink:${item.filePath}:${item.lineNumber ?? 0}`"
        type="button"
        class="dock-reference"
        :aria-label="`打开反链 ${item.title}${item.lineNumber ? ` 第 ${item.lineNumber} 行` : ''}`"
        @click="$emit('reference-select', item)"
      >
        <span class="dock-reference-heading">
          <span class="dock-reference-title">{{ item.title }}</span>
          <span v-if="item.lineNumber" class="dock-reference-line">L{{ item.lineNumber }}</span>
        </span>
        <span class="dock-reference-excerpt">{{ item.excerpt }}</span>
      </button>
      <div v-if="backlinks.length === 0" class="relation-empty-inline">暂无反链</div>
    </section>

    <section class="relation-section">
      <div class="relation-section-title">未链接提及 {{ unlinkedMentions.length }}</div>
      <div
        v-for="item in unlinkedMentions"
        :key="`mention:${item.filePath}:${item.lineNumber ?? 0}`"
        class="dock-reference-row"
      >
        <button
          type="button"
          class="dock-reference"
          :aria-label="`打开提及 ${item.title}${item.lineNumber ? ` 第 ${item.lineNumber} 行` : ''}`"
          @click="$emit('reference-select', item)"
        >
          <span class="dock-reference-heading">
            <span class="dock-reference-title">{{ item.title }}</span>
            <span v-if="item.lineNumber" class="dock-reference-line">L{{ item.lineNumber }}</span>
          </span>
          <span class="dock-reference-excerpt">{{ item.excerpt }}</span>
        </button>
        <button
          v-if="currentRecord"
          type="button"
          class="dock-reference-action"
          :aria-label="`链接提及 ${item.title}`"
          @click="$emit('link-mention', {
            reference: item,
            targetTitle: currentRecord.title,
            targetNames: [currentRecord.title, ...currentRecord.aliases],
          })"
        >
          链接
        </button>
      </div>
      <div v-if="unlinkedMentions.length === 0" class="relation-empty-inline">暂无未链接提及</div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { knowledgeIndex, type KnowledgeIndexRecord, type KnowledgeReference } from '@/services/knowledgeIndex'

const props = defineProps<{
  currentFile?: string
}>()

defineEmits<{
  (e: 'reference-select', reference: KnowledgeReference): void
  (e: 'wiki-navigate', target: string): void
  (e: 'link-mention', payload: { reference: KnowledgeReference; targetTitle: string; targetNames: string[] }): void
}>()

const currentRecord = ref<KnowledgeIndexRecord | null>(null)
const backlinks = ref<KnowledgeReference[]>([])
const unlinkedMentions = ref<KnowledgeReference[]>([])
const graphStats = reactive({
  totalNodes: 0,
  totalEdges: 0,
  orphanCount: 0,
})

let isDisposed = false
let loadVersion = 0
let unsubscribeIndex: (() => void) | null = null
let reloadTimer: ReturnType<typeof setTimeout> | null = null

const rebuildIndex = async () => {
  await knowledgeIndex.rebuildFromFiles()
}

const ensureIndexReady = async () => {
  if (await knowledgeIndex.count() === 0 || knowledgeIndex.isStale()) {
    await rebuildIndex()
  }
}

const loadRelations = async () => {
  const filePath = props.currentFile
  const version = ++loadVersion
  await ensureIndexReady()
  const graphData = await knowledgeIndex.buildGraphData()
  if (isDisposed || version !== loadVersion) return
  graphStats.totalNodes = graphData.stats.totalNodes
  graphStats.totalEdges = graphData.stats.totalEdges
  graphStats.orphanCount = graphData.stats.orphanCount

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
  if (isDisposed || version !== loadVersion || props.currentFile !== filePath) return
  currentRecord.value = record ?? null
  backlinks.value = nextBacklinks
  unlinkedMentions.value = nextMentions
}

const scheduleReload = () => {
  if (isDisposed) return
  if (reloadTimer) clearTimeout(reloadTimer)
  reloadTimer = setTimeout(() => {
    void loadRelations()
  }, 120)
}

onMounted(async () => {
  await loadRelations().catch(() => {})
  if (!isDisposed) unsubscribeIndex = knowledgeIndex.subscribe(scheduleReload)
})

onUnmounted(() => {
  isDisposed = true
  loadVersion++
  unsubscribeIndex?.()
  if (reloadTimer) clearTimeout(reloadTimer)
})

watch(() => props.currentFile, () => {
  void loadRelations().catch(() => {})
})
</script>

<style scoped>
.right-relations-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
  padding: 8px;
  color: var(--obsidian-text-muted);
}

.relation-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
  flex-shrink: 0;
}

.relation-stats span {
  min-width: 0;
  padding: 6px;
  border-radius: 4px;
  background: var(--obsidian-bg-primary);
  color: var(--obsidian-text-faint);
  font-size: 10px;
  line-height: 1.3;
}

.relation-stats strong {
  display: block;
  color: var(--obsidian-text-normal);
  font-size: 14px;
  line-height: 1.1;
}

.relation-current {
  min-width: 0;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--obsidian-border);
}

.relation-current-title {
  color: var(--obsidian-text-normal);
  font-size: 13px;
  font-weight: 650;
  line-height: 1.35;
}

.relation-current-path {
  margin-top: 3px;
  overflow: hidden;
  color: var(--obsidian-text-faint);
  font-size: 10px;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.relation-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.relation-section-title {
  color: var(--obsidian-text-faint);
  font-size: 10px;
  font-weight: 650;
  line-height: 1.4;
  text-transform: uppercase;
}

.dock-link-chip,
.dock-reference {
  width: 100%;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.dock-link-chip {
  min-height: 28px;
  padding: 5px 6px;
  color: var(--obsidian-accent);
  font-size: 12px;
}

.dock-reference {
  min-height: 44px;
  padding: 7px 8px;
}

.dock-link-chip:hover,
.dock-link-chip:focus-visible,
.dock-reference:hover,
.dock-reference:focus-visible {
  background: var(--obsidian-bg-hover);
  outline: none;
}

.dock-reference-row {
  display: flex;
  align-items: stretch;
  gap: 6px;
  min-width: 0;
}

.dock-reference-heading {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.dock-reference-title {
  min-width: 0;
  overflow: hidden;
  color: var(--obsidian-text-normal);
  font-size: 12px;
  font-weight: 650;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dock-reference-line {
  flex: 0 0 auto;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--obsidian-accent-soft);
  color: var(--obsidian-accent);
  font-size: 10px;
  font-weight: 650;
  line-height: 1.4;
}

.dock-reference-excerpt {
  display: block;
  margin-top: 4px;
  overflow: hidden;
  color: var(--obsidian-text-muted);
  font-size: 11px;
  line-height: 1.45;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dock-reference-action {
  align-self: center;
  flex: 0 0 auto;
  min-width: 42px;
  height: 28px;
  border: 1px solid color-mix(in srgb, var(--obsidian-accent) 34%, transparent);
  border-radius: 4px;
  background: var(--obsidian-accent-soft);
  color: var(--obsidian-accent);
  cursor: pointer;
  font: inherit;
  font-size: 11px;
  font-weight: 650;
}

.dock-reference-action:hover,
.dock-reference-action:focus-visible {
  background: color-mix(in srgb, var(--obsidian-accent) 24%, transparent);
  outline: none;
}

.relation-empty,
.relation-empty-inline {
  color: var(--obsidian-text-faint);
  font-size: 12px;
  line-height: 1.45;
}

.relation-empty {
  padding: 16px 4px;
  text-align: center;
}

.relation-empty-inline {
  padding: 8px 4px;
}
</style>
