<template>
  <div class="diff-view">
    <div class="diff-header">
      <span class="diff-title">修改对比</span>
      <div class="diff-actions">
        <button class="diff-btn accept" @click="$emit('accept', newText)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          接受
        </button>
        <button class="diff-btn reject" @click="$emit('reject')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          拒绝
        </button>
      </div>
    </div>
    <div class="diff-body">
      <div
        v-for="(line, idx) in diffLines"
        :key="idx"
        class="diff-line"
        :class="line.type"
      >
        <span class="line-no">{{ line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' ' }}</span>
        <span class="line-content">{{ line.content }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { computeLineDiff, type DiffLine } from './diffAlgorithm'

const props = defineProps<{
  oldText: string
  newText: string
}>()

defineEmits<{
  (e: 'accept', text: string): void
  (e: 'reject'): void
}>()

const diffLines = computed<DiffLine[]>(() => computeLineDiff(props.oldText, props.newText))
</script>

<style scoped>
.diff-view {
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  overflow: hidden;
  font-family: var(--font-mono);
  font-size: 13px;
  max-height: 400px;
  display: flex;
  flex-direction: column;
}
.diff-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-elevated);
}
.diff-title {
  font-weight: 600;
  font-size: 12px;
  color: var(--text-primary);
}
.diff-actions {
  display: flex;
  gap: 6px;
}
.diff-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: none;
  border-radius: var(--radius-xs);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}
.diff-btn.accept {
  background: var(--accent);
  color: var(--bg-crust);
}
.diff-btn.accept:hover { opacity: 0.85; }
.diff-btn.reject {
  background: var(--bg-hover);
  color: var(--text-secondary);
}
.diff-btn.reject:hover { background: var(--bg-active); }
.diff-body {
  overflow-y: auto;
  padding: 4px 0;
}
.diff-line {
  display: flex;
  padding: 2px 12px;
  line-height: 1.6;
}
.diff-line.removed {
  background: rgba(243, 139, 168, 0.12);
  color: var(--accent-red);
}
.diff-line.added {
  background: rgba(166, 227, 161, 0.12);
  color: var(--accent-green);
}
.diff-line.unchanged {
  color: var(--text-muted);
}
.line-no {
  width: 20px;
  flex-shrink: 0;
  text-align: center;
  opacity: 0.5;
}
.line-content {
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
