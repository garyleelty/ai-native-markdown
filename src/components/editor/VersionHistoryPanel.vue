<template>
  <el-drawer v-model="visible" title="版本历史" direction="rtl" size="360px">
    <div v-if="snapshots.length === 0" class="empty-history">
      <el-empty description="暂无历史记录" :image-size="48" />
    </div>
    <div v-else class="history-list">
      <el-timeline>
        <el-timeline-item
          v-for="snap in snapshots"
          :key="snap.id"
          :timestamp="formatTime(snap.timestamp)"
          placement="top"
        >
          <el-card shadow="hover" class="history-card" @click="previewSnapshot(snap)">
            <div class="history-label">{{ snap.label }}</div>
            <div class="history-meta">{{ snap.charCount }} 字符</div>
            <div class="history-actions">
              <el-button size="small" type="primary" text @click.stop="restoreSnapshot(snap)">恢复</el-button>
              <el-button size="small" type="danger" text @click.stop="deleteSnapshot(snap)">删除</el-button>
            </div>
          </el-card>
        </el-timeline-item>
      </el-timeline>
    </div>

    <el-dialog v-model="showPreview" title="版本预览" width="500px" append-to-body>
      <div class="preview-content">{{ previewContent }}</div>
      <template #footer>
        <el-button @click="showPreview = false">关闭</el-button>
        <el-button type="primary" @click="restoreFromPreview">恢复此版本</el-button>
      </template>
    </el-dialog>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { versionHistory, type Snapshot } from '@/services/versionHistory'

const props = defineProps<{ modelValue: boolean; filePath: string }>()
const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
  (e: 'restore', content: string): void
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

const snapshots = ref<Snapshot[]>([])
const showPreview = ref(false)
const previewContent = ref('')
const previewSnapshotId = ref(0)

watch(() => props.modelValue, async (val) => {
  if (val && props.filePath) {
    snapshots.value = await versionHistory.getSnapshots(props.filePath)
  }
})

const formatTime = (ts: number) => {
  return new Date(ts).toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  })
}

const previewSnapshot = async (snap: Snapshot) => {
  previewContent.value = snap.content
  previewSnapshotId.value = snap.id!
  showPreview.value = true
}

const restoreSnapshot = async (snap: Snapshot) => {
  try {
    await ElMessageBox.confirm('恢复此版本将覆盖当前内容，确定继续？', '恢复确认', { type: 'warning' })
    const content = await versionHistory.restoreSnapshot(snap.id!)
    if (content) {
      emit('restore', content)
      ElMessage.success('已恢复')
    }
  } catch {}
}

const deleteSnapshot = async (snap: Snapshot) => {
  try {
    await ElMessageBox.confirm('确定删除此历史版本？', '删除确认', { type: 'warning' })
    await versionHistory.deleteSnapshot(snap.id!)
    snapshots.value = await versionHistory.getSnapshots(props.filePath)
    ElMessage.success('已删除')
  } catch {}
}

const restoreFromPreview = async () => {
  const content = await versionHistory.restoreSnapshot(previewSnapshotId.value)
  if (content) {
    emit('restore', content)
    showPreview.value = false
    ElMessage.success('已恢复')
  }
}
</script>

<style scoped>
.empty-history {
  padding: 32px 0;
}

.history-card {
  cursor: pointer;
}

.history-card :deep(.el-card__body) {
  padding: 10px 14px;
}

.history-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--obsidian-text-normal);
}

.history-meta {
  font-size: 11px;
  color: var(--obsidian-text-faint);
  margin-top: 2px;
}

.history-actions {
  margin-top: 6px;
  display: flex;
  gap: 4px;
}

.preview-content {
  max-height: 400px;
  overflow-y: auto;
  font-family: var(--font-mono, monospace);
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--obsidian-text-normal);
  background: var(--obsidian-bg-tertiary);
  padding: 16px;
  border-radius: var(--radius-md);
}
</style>
