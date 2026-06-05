<template>
  <Transition name="focus-toolbar">
    <div class="focus-mode-toolbar" v-if="active">
      <el-tooltip content="退出专注模式 (Esc)" placement="bottom">
        <el-button :icon="Close" native-type="button" circle size="small" aria-label="退出专注模式" @click="$emit('exit')" />
      </el-tooltip>
      <span class="focus-file-name">{{ fileName }}</span>
      <span class="focus-stats">{{ wordCount }} 词</span>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { Close } from '@element-plus/icons-vue'

defineProps<{
  active: boolean
  fileName: string
  wordCount: number
}>()

defineEmits<{
  (e: 'exit'): void
}>()
</script>

<style scoped>
.focus-mode-toolbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  padding: 8px 16px;
  gap: 12px;
  opacity: 0;
  transition: opacity 0.3s;
  pointer-events: auto;
}

.focus-mode-toolbar:hover {
  opacity: 1;
  background: var(--obsidian-bg-primary);
  backdrop-filter: blur(8px);
}

.focus-file-name {
  flex: 1;
  text-align: center;
  font-size: 13px;
  color: var(--obsidian-text-muted);
}

.focus-stats {
  font-size: 12px;
  color: var(--obsidian-text-muted);
  opacity: 0.6;
}

.focus-toolbar-enter-active,
.focus-toolbar-leave-active {
  transition: opacity 0.3s;
}

.focus-toolbar-enter-from,
.focus-toolbar-leave-to {
  opacity: 0;
}
</style>
