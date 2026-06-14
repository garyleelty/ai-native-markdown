<template>
  <div class="outline-panel">
    <div class="outline-list">
      <div
        v-for="heading in visibleHeadings"
        :key="heading.lineNumber"
        class="outline-item"
        :class="{
          [`level-${heading.level}`]: true,
          active: heading.lineNumber === activeHeadingLineNumber,
          'has-children': heading.hasChildren,
          collapsed: heading.collapsed,
        }"
        @click="handleHeadingClick(heading)"
      >
        <el-icon v-if="heading.hasChildren" :size="10" class="collapse-toggle">
          <ArrowRight :class="{ rotated: !heading.collapsed }" />
        </el-icon>
        <span class="outline-text">{{ heading.text }}</span>
      </div>
      <div v-if="headings.length === 0" class="outline-empty">
        暂无标题
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive } from 'vue'
import { List, ArrowRight } from '@element-plus/icons-vue'
import { extractMarkdownHeadings } from '@/utils/wikiLinks'

interface Heading {
  level: number
  text: string
  lineNumber: number
  hasChildren: boolean
  collapsed: boolean
}

const props = defineProps<{
  content: string
  cursorLine: number
}>()

const emit = defineEmits<{
  (e: 'navigate', lineNumber: number): void
}>()

const collapsedLines = reactive(new Set<number>())

const headings = computed<Heading[]>(() => {
  if (!props.content) return []
  return extractMarkdownHeadings(props.content).map(heading => ({
    level: heading.level,
    text: heading.text,
    lineNumber: heading.lineNumber,
    hasChildren: false,
    collapsed: collapsedLines.has(heading.lineNumber),
  }))
})

const visibleHeadings = computed(() => {
  const all = headings.value
  if (all.length === 0) return []

  const result: Heading[] = []
  let skipBelowLevel = -1

  for (let i = 0; i < all.length; i++) {
    const heading = all[i]
    if (skipBelowLevel > 0 && heading.level > skipBelowLevel) continue
    skipBelowLevel = -1

    const nextHeading = all[i + 1]
    const hasChildren = nextHeading !== undefined && nextHeading.level > heading.level

    if (collapsedLines.has(heading.lineNumber) && hasChildren) {
      skipBelowLevel = heading.level
    }

    result.push({ ...heading, hasChildren })
  }

  return result
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

const handleHeadingClick = (heading: Heading) => {
  if (heading.hasChildren) {
    if (collapsedLines.has(heading.lineNumber)) {
      collapsedLines.delete(heading.lineNumber)
    } else {
      collapsedLines.add(heading.lineNumber)
    }
  }
  emit('navigate', heading.lineNumber)
}
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
  color: var(--obsidian-text-muted);
  transition: all 0.15s ease;
  white-space: nowrap;
  overflow: hidden;
}

.outline-item:hover {
  background: var(--obsidian-bg-hover);
  color: var(--obsidian-text-normal);
}

.outline-item.active {
  background: var(--obsidian-accent-soft);
  color: var(--obsidian-accent);
  font-weight: 600;
}

.collapse-toggle {
  flex-shrink: 0;
  transition: transform 0.15s ease;
  color: var(--obsidian-text-faint);
}

.collapse-toggle .rotated {
  transform: rotate(90deg);
}

.outline-item:hover .collapse-toggle {
  color: var(--obsidian-text-muted);
}

.outline-text {
  overflow: hidden;
  text-overflow: ellipsis;
}

.level-1 { font-weight: 600; color: var(--obsidian-text-normal); padding-left: 8px; }
.level-2 { padding-left: 20px; }
.level-3 { padding-left: 32px; font-size: 12px; }
.level-4 { padding-left: 44px; font-size: 11.5px; }
.level-5 { padding-left: 56px; font-size: 11.5px; }
.level-6 { padding-left: 68px; font-size: 11.5px; }

.outline-empty {
  padding: 24px;
  text-align: center;
  color: var(--obsidian-text-faint);
  font-size: 12px;
}
</style>
