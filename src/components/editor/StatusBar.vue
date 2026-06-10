<template>
  <div class="status-bar" v-if="visible">
    <div class="status-left">
      <span class="status-item" title="总字符数">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        {{ formattedCharCount }} 字
      </span>
      <span class="status-divider"></span>
      <span class="status-item" title="行数">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
        {{ formattedLineCount }} 行
      </span>
      <span class="status-divider"></span>
      <span class="status-item" title="预计阅读时间">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        {{ readingTime }}
      </span>
      <span class="status-divider"></span>
      <span class="status-item" title="光标位置">
        Ln {{ cursorLine }}, Col {{ cursorCol }}
      </span>
    </div>
    <div class="status-right">
      <span class="status-item status-selection" v-if="selectedText">
        已选 {{ selectedCharCount }} 字
      </span>
      <span class="status-item" :class="{ connected: aiConnected }" title="AI 连接状态">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="8"/></svg>
        {{ aiConnected ? 'AI 在线' : 'AI 离线' }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  visible?: boolean
  charCount: number
  lineCount: number
  cursorLine: number
  cursorCol: number
  selectedText: string
  aiConnected: boolean
}>()

const formattedCharCount = computed(() => {
  if (props.charCount >= 10000) {
    return (props.charCount / 10000).toFixed(1) + '万'
  }
  return props.charCount.toLocaleString()
})

const formattedLineCount = computed(() => {
  if (props.lineCount >= 1000) {
    return (props.lineCount / 1000).toFixed(1) + 'k'
  }
  return props.lineCount.toLocaleString()
})

const readingTime = computed(() => {
  // 中文字均阅读速度 ~400字/分钟
  const minutes = Math.ceil(props.charCount / 400)
  if (minutes < 1) return '< 1 分钟'
  if (minutes === 1) return '1 分钟'
  return `${minutes} 分钟`
})

const selectedCharCount = computed(() => props.selectedText.length)
</script>

<style scoped>
.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 24px;
  min-height: 24px;
  padding: 0 var(--space-3);
  background: var(--bg-elevated);
  border-top: 1px solid var(--border-subtle);
  font-size: 10.5px;
  color: var(--text-muted);
  user-select: none;
  overflow: hidden;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.status-left,
.status-right {
  display: flex;
  align-items: center;
  gap: 2px;
}

.status-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: var(--radius-xs);
  cursor: default;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.status-item:hover {
  background: var(--bg-hover);
  color: var(--text-secondary);
}

.status-item:active {
  transform: scale(0.95);
}

.status-item svg {
  opacity: 0.7;
  transition: opacity 0.15s ease;
}

.status-item:hover svg {
  opacity: 1;
}

.status-divider {
  width: 1px;
  height: 10px;
  background: var(--border-default);
  margin: 0 4px;
}

.status-selection {
  color: var(--accent-primary);
  font-weight: 600;
  background: rgba(127, 109, 242, 0.1);
}

.status-selection:hover {
  background: rgba(127, 109, 242, 0.15);
}

.status-item.connected {
  color: #22c55e;
}

.status-item.connected svg {
  color: #22c55e;
  opacity: 1;
  animation: pulse 2s ease-in-out infinite;
}

.status-item:not(.connected) svg {
  color: var(--text-muted);
  opacity: 0.5;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>