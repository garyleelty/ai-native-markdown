<template>
  <div v-if="items.length" class="reference-list">
    <div
      v-for="item in items"
      :key="`${item.filePath}:${item.lineNumber ?? 0}`"
      class="reference-item"
    >
      <button
        type="button"
        class="reference-main"
        :aria-label="`打开 ${item.title}${item.lineNumber ? ` 第 ${item.lineNumber} 行` : ''}`"
        @click="$emit('select', item)"
      >
        <span class="reference-heading">
          <span class="reference-title">{{ item.title }}</span>
          <span v-if="item.lineNumber" class="reference-line">L{{ item.lineNumber }}</span>
        </span>
        <span class="reference-path">{{ item.filePath }}</span>
        <span class="reference-excerpt">{{ item.excerpt }}</span>
      </button>
      <button
        v-if="actionLabel"
        class="reference-action"
        type="button"
        :aria-label="`${actionLabel} ${item.title}`"
        @click.stop="$emit('action', item)"
      >
        {{ actionLabel }}
      </button>
    </div>
  </div>
  <div v-else class="empty-inline">{{ emptyText }}</div>
</template>

<script setup lang="ts">
import type { KnowledgeReference } from '../../services/knowledgeIndex'

defineProps<{
  items: KnowledgeReference[]
  emptyText: string
  actionLabel?: string
}>()

defineEmits<{
  (e: 'select', item: KnowledgeReference): void
  (e: 'action', item: KnowledgeReference): void
}>()
</script>
