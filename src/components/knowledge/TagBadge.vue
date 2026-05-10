<template>
  <span class="tag-badge" @click="$emit('click', name)">
    #{{ name }}
  </span>
</template>

<script setup lang="ts">
defineProps<{
  name: string
}>()

defineEmits<{
  (e: 'click', name: string): void
}>()
</script>

<style scoped>
.tag-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  background: var(--accent-soft);
  color: var(--accent);
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  user-select: none;
}
.tag-badge:hover {
  background: var(--accent);
  color: #fff;
  transform: translateY(-1px);
}
</style>
