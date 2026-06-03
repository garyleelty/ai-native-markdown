<template>
  <div v-if="items.length" class="reference-list">
    <button
      v-for="item in items"
      :key="item.filePath"
      class="reference-item"
      @click="$emit('select', item.filePath)"
    >
      <span class="reference-title">{{ item.title }}</span>
      <span class="reference-path">{{ item.filePath }}</span>
      <span class="reference-excerpt">{{ item.excerpt }}</span>
    </button>
  </div>
  <div v-else class="empty-inline">{{ emptyText }}</div>
</template>

<script setup lang="ts">
import type { KnowledgeReference } from '../../services/knowledgeIndex'

defineProps<{
  items: KnowledgeReference[]
  emptyText: string
}>()

defineEmits<{
  (e: 'select', path: string): void
}>()
</script>
