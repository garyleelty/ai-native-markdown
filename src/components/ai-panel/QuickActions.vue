<template>
  <div class="quick-actions">
    <div class="quick-actions-label">快捷操作</div>
    <el-button-group class="quick-actions-group">
      <el-button
        v-for="action in actions"
        :key="action.label"
        size="small"
        native-type="button"
        :disabled="disabled"
        @click="$emit('action', action.prompt, action.label)"
      >
        <el-icon><component :is="action.icon" /></el-icon>
        {{ action.label }}
      </el-button>
    </el-button-group>
  </div>
</template>

<script setup lang="ts">
import { EditPen, MagicStick, Document, Edit, Expand, Fold } from '@element-plus/icons-vue'

defineProps<{
  disabled?: boolean
}>()

defineEmits<{
  (e: 'action', prompt: string, label: string): void
}>()

const actions = [
  { label: '续写', prompt: '请继续续写以下内容：\n\n', icon: EditPen },
  { label: '润色', prompt: '请润色以下文本，使其更加流畅优美：\n\n', icon: MagicStick },
  { label: '摘要', prompt: '请为以下内容生成摘要：\n\n', icon: Document },
  { label: '修正语法', prompt: '请修正以下文本中的语法错误：\n\n', icon: Edit },
  { label: '展开', prompt: '请展开以下内容，增加更多细节：\n\n', icon: Expand },
  { label: '压缩', prompt: '请压缩以下内容，使其更加简洁：\n\n', icon: Fold },
]
</script>

<style scoped>
.quick-actions {
  padding: 8px 16px 4px;
  flex-shrink: 0;
}

.quick-actions-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--obsidian-text-faint);
  margin-bottom: 6px;
  letter-spacing: 0;
}

.quick-actions-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0;
}

.quick-actions-group :deep(.el-button) {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 0;
}

.quick-actions-group :deep(.el-button:first-child) {
  border-radius: 4px 0 0 4px;
}

.quick-actions-group :deep(.el-button:last-child) {
  border-radius: 0 4px 4px 0;
}

.quick-actions-group :deep(.el-button .el-icon) {
  margin-right: 2px;
}
</style>
