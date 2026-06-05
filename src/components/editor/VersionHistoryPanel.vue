<template>
  <el-drawer v-model="visible" title="版本历史" direction="rtl" size="360px" class="responsive-drawer">
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
              <el-button size="small" type="primary" native-type="button" text @click.stop="restoreSnapshot(snap)">恢复</el-button>
              <el-button size="small" type="danger" native-type="button" text @click.stop="deleteSnapshot(snap)">删除</el-button>
            </div>
          </el-card>
        </el-timeline-item>
      </el-timeline>
    </div>

    <el-dialog v-model="showPreview" title="版本预览" width="500px" class="responsive-dialog" append-to-body>
      <div class="preview-content">{{ previewContent }}</div>
      <template #footer>
        <el-button native-type="button" @click="showPreview = false">关闭</el-button>
        <el-button type="primary" native-type="button" @click="restoreFromPreview">恢复此版本</el-button>
      </template>
    </el-dialog>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
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
const previewSnapshotPath = ref('')
let isDisposed = false
let loadVersion = 0

const resetPreview = () => {
  showPreview.value = false
  previewContent.value = ''
  previewSnapshotId.value = 0
  previewSnapshotPath.value = ''
}

const isMessageBoxCancel = (error: unknown) => {
  return error === 'cancel' || error === 'close'
}

const loadSnapshots = async () => {
  const version = ++loadVersion
  const activeFilePath = props.filePath
  if (!props.modelValue || !activeFilePath) {
    snapshots.value = []
    return
  }

  const nextSnapshots = await versionHistory.getSnapshots(activeFilePath)
  if (isDisposed || version !== loadVersion || props.filePath !== activeFilePath || !props.modelValue) return
  snapshots.value = nextSnapshots
}

watch([() => props.modelValue, () => props.filePath], ([isVisible, filePath], previous = [false, '']) => {
  const [, previousFilePath] = previous
  if (!isVisible || filePath !== previousFilePath) resetPreview()
  void loadSnapshots()
}, { immediate: true })

const formatTime = (ts: number) => {
  return new Date(ts).toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  })
}

const previewSnapshot = async (snap: Snapshot) => {
  if (!snap.id) return
  previewContent.value = snap.content
  previewSnapshotId.value = snap.id
  previewSnapshotPath.value = snap.filePath
  showPreview.value = true
}

const restoreSnapshot = async (snap: Snapshot) => {
  if (!snap.id) return
  const activeFilePath = props.filePath
  if (snap.filePath !== activeFilePath) {
    ElMessage.warning('此历史版本不属于当前文件')
    return
  }
  try {
    await ElMessageBox.confirm('恢复此版本将覆盖当前内容，确定继续？', '恢复确认', { type: 'warning' })
    if (isDisposed || props.filePath !== activeFilePath) return
    const content = await versionHistory.restoreSnapshot(snap.id)
    if (content) {
      emit('restore', content)
      ElMessage.success('已恢复')
    } else {
      ElMessage.error('历史版本不存在或已被删除')
    }
  } catch (error) {
    if (!isMessageBoxCancel(error)) ElMessage.error('恢复历史版本失败')
  }
}

const deleteSnapshot = async (snap: Snapshot) => {
  if (!snap.id) return
  const activeFilePath = props.filePath
  if (snap.filePath !== activeFilePath) {
    ElMessage.warning('此历史版本不属于当前文件')
    return
  }
  try {
    await ElMessageBox.confirm('确定删除此历史版本？', '删除确认', { type: 'warning' })
    if (isDisposed || props.filePath !== activeFilePath) return
    await versionHistory.deleteSnapshot(snap.id)
    await loadSnapshots()
    ElMessage.success('已删除')
  } catch (error) {
    if (!isMessageBoxCancel(error)) ElMessage.error('删除历史版本失败')
  }
}

const restoreFromPreview = async () => {
  const activeFilePath = props.filePath
  if (!previewSnapshotId.value || previewSnapshotPath.value !== activeFilePath) {
    resetPreview()
    ElMessage.warning('此历史版本不属于当前文件')
    return
  }
  const content = await versionHistory.restoreSnapshot(previewSnapshotId.value)
  if (content) {
    emit('restore', content)
    showPreview.value = false
    ElMessage.success('已恢复')
  } else {
    ElMessage.error('历史版本不存在或已被删除')
  }
}

onUnmounted(() => {
  isDisposed = true
  loadVersion += 1
})
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
