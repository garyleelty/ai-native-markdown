<template>
  <div class="outline-panel">
    <div class="outline-header">
      <span class="outline-title">大纲</span>
    </div>
    <div class="outline-list">
      <div
        v-for="heading in headings"
        :key="heading.from"
        class="outline-item"
        :class="`level-${heading.level}`"
        @click="$emit('select', heading)"
      >
        {{ heading.text }}
      </div>
      <div v-if="headings.length === 0" class="outline-empty">
        暂无标题
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Heading {
  level: number
  text: string
  from: number
  to: number
}

defineProps<{
  headings: Heading[]
}>()

defineEmits<{
  (e: 'select', heading: Heading): void
}>()
</script>

<style scoped>
.outline-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.outline-header {
  padding: 12px 14px 8px;
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
}
.outline-title {
  font-size: 10.5px;
  font-weight: 800;
  color: var(--text-muted);
  letter-spacing: 1.5px;
  text-transform: uppercase;
}
.outline-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px 8px;
}
.outline-item {
  padding: 5px 8px;
  cursor: pointer;
  border-radius: var(--radius-xs);
  font-size: 12.5px;
  color: var(--text-secondary);
  transition: all var(--transition-fast);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.outline-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.level-1 { font-weight: 600; color: var(--text-primary); padding-left: 8px; }
.level-2 { padding-left: 18px; }
.level-3 { padding-left: 28px; font-size: 12px; }
.level-4 { padding-left: 38px; font-size: 11.5px; }
.level-5 { padding-left: 48px; font-size: 11.5px; }
.level-6 { padding-left: 58px; font-size: 11.5px; }
.outline-empty {
  padding: 24px;
  text-align: center;
  color: var(--text-muted);
  font-size: 12px;
}
</style>
