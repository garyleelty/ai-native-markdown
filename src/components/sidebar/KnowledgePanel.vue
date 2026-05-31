<template>
  <div class="panel">
    <div class="panel-header">
      <span class="panel-title">知识图谱</span>
    </div>
    <div class="graph-panel-content" v-if="rootPath">
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
    <el-empty v-else description="打开工作区后可查看知识图谱" :image-size="48" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Loading } from '@element-plus/icons-vue'
import { KnowledgeGraph } from '../knowledge'
import { buildKnowledgeGraph } from '../../utils/knowledge'
import type { KnowledgeGraphData, GraphNode } from '../../types'
import { fileSystem } from '../../services/fileSystem'

interface Props {
  rootPath?: string
}
const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'select', path: string): void
}>()

const graphData = ref<KnowledgeGraphData | null>(null)
const graphLoading = ref(false)

const loadGraphData = async () => {
  graphLoading.value = true
  try {
    const files = await fileSystem.getAllMarkdownFiles()
    const allFiles = await Promise.all(files.map(async f => ({
      path: f.path,
      content: await fileSystem.readFile(f.path)
    })))
    graphData.value = buildKnowledgeGraph(allFiles)
  } catch (e: any) {
    ElMessage.error('加载图谱失败')
  } finally {
    graphLoading.value = false
  }
}

const handleGraphNodeClick = (node: GraphNode) => { emit('select', node.path) }

onMounted(() => {
  loadGraphData()
})

watch(() => props.rootPath, (newPath, oldPath) => {
  if (newPath && newPath !== oldPath) {
    loadGraphData()
  }
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

.graph-panel-content {
  flex: 1;
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

.panel :deep(.el-empty__description p) {
  color: var(--obsidian-text-faint, #666);
}
</style>
