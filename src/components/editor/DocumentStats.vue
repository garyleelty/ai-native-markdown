<template>
  <el-popover placement="top" :width="240" trigger="click">
    <template #reference>
      <slot />
    </template>
    <div class="doc-stats">
      <div class="stat-row">
        <span class="stat-label">字符数</span>
        <span class="stat-value">{{ stats.chars }}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">词数</span>
        <span class="stat-value">{{ stats.words }}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">行数</span>
        <span class="stat-value">{{ stats.lines }}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">段落数</span>
        <span class="stat-value">{{ stats.paragraphs }}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">标题数</span>
        <span class="stat-value">{{ stats.headings }}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">链接数</span>
        <span class="stat-value">{{ stats.links }}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">图片数</span>
        <span class="stat-value">{{ stats.images }}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">代码块数</span>
        <span class="stat-value">{{ stats.codeBlocks }}</span>
      </div>
      <el-divider style="margin: 8px 0" />
      <div class="stat-row">
        <span class="stat-label">预计阅读</span>
        <span class="stat-value">{{ readTime }}</span>
      </div>
    </div>
  </el-popover>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ content: string }>()

const stats = computed(() => {
  const text = props.content
  const chars = text.length
  const cjk = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length
  const words = text.replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, ' ').split(/\s+/).filter(w => w.length > 0).length
  const totalWords = cjk + words
  const lines = text.split('\n').length
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0).length
  const headings = (text.match(/^#{1,6}\s/mg) || []).length
  const links = (text.match(/\[([^\]]*)\]\([^)]+\)/g) || []).length
  const images = (text.match(/!\[([^\]]*)\]\([^)]+\)/g) || []).length
  const codeBlocks = (text.match(/```[\s\S]*?```/g) || []).length
  return { chars, words: totalWords, lines, paragraphs, headings, links, images, codeBlocks }
})

const readTime = computed(() => {
  const mins = Math.ceil(stats.value.words / 300)
  return mins <= 1 ? '不到 1 分钟' : `约 ${mins} 分钟`
})
</script>

<style scoped>
.doc-stats {
  font-size: 13px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
}

.stat-label {
  color: var(--obsidian-text-muted);
}

.stat-value {
  font-weight: 600;
  color: var(--obsidian-text-normal);
}
</style>
