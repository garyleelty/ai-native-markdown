<template>
  <div class="outline-panel">
    <div class="outline-list">
      <div
        v-for="heading in headings"
        :key="heading.lineNumber"
        class="outline-item"
        :class="{
          [`level-${heading.level}`]: true,
          active: heading.lineNumber === activeHeadingLineNumber
        }"
        @click="$emit('navigate', heading.lineNumber)"
      >
        <el-icon :size="12"><List /></el-icon>
        <span class="outline-text">{{ heading.text }}</span>
      </div>
      <div v-if="headings.length === 0" class="outline-empty">
        暂无标题
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { List } from '@element-plus/icons-vue'
import { extractMarkdownHeadings } from '@/utils/wikiLinks'

interface Heading {
  level: number
  text: string
  lineNumber: number
}

const props = defineProps<{
  content: string
  cursorLine: number
}>()

defineEmits<{
  (e: 'navigate', lineNumber: number): void
}>()

const headings = computed<Heading[]>(() => {
  if (!props.content) return []
  return extractMarkdownHeadings(props.content).map(heading => ({
    level: heading.level,
    text: heading.text,
    lineNumber: heading.lineNumber,
  }))
})

const activeHeadingLineNumber = computed(() => {
  if (!props.cursorLine || headings.value.length === 0) return -1
  let active = -1
  for (const heading of headings.value) {
    if (heading.lineNumber <= props.cursorLine) {
      active = heading.lineNumber
    } else {
      break
    }
  }
  return active
})
</script>

<style scoped>
.outline-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.outline-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px 8px;
}

.outline-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  cursor: pointer;
  border-radius: 4px;
  font-size: 12.5px;
  color: var(--el-text-color-secondary);
  transition: all 0.15s ease;
  white-space: nowrap;
  overflow: hidden;
}

.outline-item:hover {
  background: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
}

.outline-item.active {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-weight: 600;
}

.outline-text {
  overflow: hidden;
  text-overflow: ellipsis;
}

.level-1 { font-weight: 600; color: var(--el-text-color-primary); padding-left: 8px; }
.level-2 { padding-left: 20px; }
.level-3 { padding-left: 32px; font-size: 12px; }
.level-4 { padding-left: 44px; font-size: 11.5px; }
.level-5 { padding-left: 56px; font-size: 11.5px; }
.level-6 { padding-left: 68px; font-size: 11.5px; }

.outline-empty {
  padding: 24px;
  text-align: center;
  color: var(--el-text-color-placeholder);
  font-size: 12px;
}
</style>
