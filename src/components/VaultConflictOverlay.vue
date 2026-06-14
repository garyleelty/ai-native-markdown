<template>
  <div
    v-if="externalConflicts.length > 0 && !currentExternalConflict"
    class="vault-conflict-overview"
    role="status"
  >
    <div class="vault-conflict-overview-message">
      <el-icon><WarningFilled /></el-icon>
      <span>{{ conflictHandler.formatExternalConflictOverviewMessage() }}</span>
    </div>
    <div class="vault-conflict-file-list" aria-label="冲突文件列表">
      <button
        v-for="conflict in externalConflicts"
        :key="conflict.path"
        class="vault-conflict-chip"
        type="button"
        :title="conflict.path"
        :aria-label="`查看冲突 ${conflictHandler.formatConflictFileName(conflict.path)}`"
        @click="emit('focus-conflict', conflict.path)"
      >
        {{ conflictHandler.formatConflictFileName(conflict.path) }}
      </button>
    </div>
  </div>
  <div
    v-if="currentExternalConflict"
    class="vault-conflict-banner"
    :class="{
      'is-missing': currentExternalConflict.diskState === 'missing',
      'is-unreadable': currentExternalConflict.diskState === 'unreadable'
    }"
    role="status"
  >
    <div class="vault-conflict-topline">
      <div class="vault-conflict-message">
        <el-icon><WarningFilled /></el-icon>
        <span>{{ conflictHandler.formatExternalConflictMessage(currentExternalConflict) }}</span>
      </div>
      <div class="vault-conflict-actions">
        <el-button
          v-if="conflictHandler.isExternalConflictReloadable(currentExternalConflict)"
          size="small"
          :icon="RefreshLeft"
          native-type="button"
          @click="conflictHandler.reloadCurrentConflictFromDisk"
        >重新载入磁盘版本</el-button>
        <el-button size="small" :icon="Clock" native-type="button" @click="conflictHandler.saveCurrentConflictSnapshot">保存本地快照</el-button>
        <el-button size="small" :icon="Clock" native-type="button" @click="emit('show-version-history')">版本历史</el-button>
        <el-button size="small" :icon="Select" native-type="button" @click="conflictHandler.keepCurrentConflictLocal">保留本地版本</el-button>
      </div>
    </div>
    <div
      v-if="otherExternalConflicts.length > 0"
      class="vault-conflict-related"
      aria-label="其它冲突文件"
    >
      <span>另有 {{ otherExternalConflicts.length }} 个冲突</span>
      <div class="vault-conflict-file-list">
        <button
          v-for="conflict in otherExternalConflicts"
          :key="conflict.path"
          class="vault-conflict-chip"
          type="button"
          :title="conflict.path"
          :aria-label="`查看冲突 ${conflictHandler.formatConflictFileName(conflict.path)}`"
          @click="emit('focus-conflict', conflict.path)"
        >
          {{ conflictHandler.formatConflictFileName(conflict.path) }}
        </button>
      </div>
    </div>
    <div class="vault-conflict-diff" aria-label="冲突差异预览">
      <div class="vault-conflict-summary">{{ conflictHandler.formatExternalConflictSummary(currentExternalConflict) }}</div>
      <div class="vault-conflict-lines">
        <div
          v-for="(line, index) in conflictHandler.buildExternalConflictPreview(currentExternalConflict)"
          :key="`${line.type}-${line.lineNumber}-${index}`"
          class="vault-conflict-line"
          :class="line.type"
        >
          <span class="vault-conflict-marker">{{ conflictHandler.formatConflictLineMarker(line.type) }}</span>
          <span class="vault-conflict-line-number">{{ line.lineNumber ? `L${line.lineNumber}` : '' }}</span>
          <span class="vault-conflict-line-content">{{ line.content || ' ' }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { WarningFilled, RefreshLeft, Clock, Select } from '@element-plus/icons-vue'

interface Props {
  externalConflicts: any[]
  currentExternalConflict: any
  otherExternalConflicts: any[]
  conflictHandler: any
}

defineProps<Props>()

const emit = defineEmits<{
  'focus-conflict': [path: string]
  'show-version-history': []
}>()
</script>

<style scoped>
.vault-conflict-banner {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
  padding: 8px 12px;
  background: rgba(196, 132, 48, 0.14);
  border-bottom: 1px solid rgba(196, 132, 48, 0.36);
  color: var(--obsidian-text-normal);
}

.vault-conflict-overview {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 7px 12px;
  background: rgba(196, 132, 48, 0.11);
  border-bottom: 1px solid rgba(196, 132, 48, 0.3);
  color: var(--obsidian-text-normal);
}

.vault-conflict-overview-message,
.vault-conflict-related {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  line-height: 1.35;
}

.vault-conflict-overview-message .el-icon {
  flex-shrink: 0;
  color: var(--obsidian-warning, #d6a04b);
}

.vault-conflict-related {
  color: var(--obsidian-text-muted);
}

.vault-conflict-file-list {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  flex-wrap: wrap;
}

.vault-conflict-chip {
  max-width: 180px;
  min-height: 24px;
  padding: 2px 8px;
  border: 1px solid rgba(196, 132, 48, 0.32);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.04);
  color: var(--obsidian-text-normal);
  font: inherit;
  font-size: 12px;
  line-height: 1.35;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vault-conflict-chip:hover,
.vault-conflict-chip:focus-visible {
  border-color: var(--obsidian-accent);
  color: var(--obsidian-accent);
  outline: none;
}

.vault-conflict-banner.is-missing,
.vault-conflict-banner.is-unreadable {
  background: rgba(190, 70, 70, 0.12);
  border-bottom-color: rgba(190, 70, 70, 0.34);
}

.vault-conflict-banner.is-missing .vault-conflict-message .el-icon,
.vault-conflict-banner.is-unreadable .vault-conflict-message .el-icon {
  color: var(--obsidian-danger, #d66f6f);
}

.vault-conflict-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}

.vault-conflict-message {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  line-height: 1.4;
}

.vault-conflict-message .el-icon {
  flex-shrink: 0;
  color: var(--obsidian-warning, #d6a04b);
}

.vault-conflict-actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.vault-conflict-actions .el-button {
  border-radius: var(--radius-sm) !important;
}

.vault-conflict-diff {
  min-width: 0;
  color: var(--obsidian-text-muted);
  font-size: 11px;
  line-height: 1.35;
}

.vault-conflict-summary {
  margin-bottom: 4px;
  color: var(--obsidian-text-muted);
}

.vault-conflict-lines {
  display: grid;
  gap: 2px;
  max-height: 120px;
  overflow: auto;
  font-family: var(--font-mono);
}

.vault-conflict-line {
  display: grid;
  grid-template-columns: 34px 42px minmax(0, 1fr);
  gap: 6px;
  align-items: baseline;
  min-width: 0;
}

.vault-conflict-line.local .vault-conflict-marker {
  color: var(--obsidian-warning-light, #e0b76c);
}

.vault-conflict-line.disk .vault-conflict-marker {
  color: var(--obsidian-accent);
}

.vault-conflict-marker,
.vault-conflict-line-number {
  white-space: nowrap;
  color: var(--obsidian-text-faint);
}

.vault-conflict-line-content {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 768px) {
  .vault-conflict-banner {
    align-items: flex-start;
    flex-direction: column;
  }

  .vault-conflict-overview {
    align-items: flex-start;
    flex-direction: column;
  }

  .vault-conflict-topline {
    align-items: flex-start;
    flex-direction: column;
    width: 100%;
  }

  .vault-conflict-actions {
    width: 100%;
    justify-content: flex-end;
    flex-wrap: wrap;
  }

  .vault-conflict-file-list {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>
