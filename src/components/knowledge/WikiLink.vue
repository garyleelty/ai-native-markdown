<template>
  <a
    class="wiki-link"
    :class="{ 'wiki-link-exists': exists, 'wiki-link-new': !exists }"
    @click.prevent="$emit('click', target)"
  >
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
    <span>{{ displayText }}</span>
  </a>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  target: string
  display?: string
  exists: boolean
}>()

const displayText = computed(() => props.display || props.target)

defineEmits<{
  (e: 'click', target: string): void
}>()
</script>

<style scoped>
.wiki-link {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: var(--accent);
  text-decoration: none;
  cursor: pointer;
  border-bottom: 1px dashed var(--accent);
  transition: all var(--transition-fast);
  padding: 0 2px;
  border-radius: 2px;
}
.wiki-link:hover {
  background: var(--accent-soft);
  border-bottom-style: solid;
}
.wiki-link-new {
  color: var(--text-muted);
  border-bottom-color: var(--text-muted);
}
.wiki-link-new:hover {
  color: var(--accent);
  border-bottom-color: var(--accent);
}
</style>
