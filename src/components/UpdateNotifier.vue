<template>
  <Transition name="update-slide">
    <div v-if="showBanner" class="update-banner" :class="updateState.status">
      <div class="update-banner-content">
        <el-icon :size="16">
          <Download v-if="updateState.status === 'available'" />
          <Loading v-else-if="updateState.status === 'downloading'" />
          <CircleCheck v-else-if="updateState.status === 'downloaded'" />
          <Warning v-else-if="updateState.status === 'error'" />
        </el-icon>
        <span class="update-text">
          <template v-if="updateState.status === 'available'">
            新版本 {{ updateState.version }} 可用
          </template>
          <template v-else-if="updateState.status === 'downloading'">
            下载中 {{ updateState.downloadPercent ?? 0 }}%
          </template>
          <template v-else-if="updateState.status === 'downloaded'">
            更新已就绪，重启生效
          </template>
          <template v-else-if="updateState.status === 'error'">
            更新检查失败
          </template>
        </span>
      </div>
      <div class="update-banner-actions">
        <el-button
          v-if="updateState.status === 'available'"
          size="small"
          type="primary"
          @click="downloadUpdate"
        >
          下载更新
        </el-button>
        <el-button
          v-if="updateState.status === 'downloaded'"
          size="small"
          type="primary"
          @click="installUpdate"
        >
          立即重启
        </el-button>
        <el-button
          size="small"
          text
          @click="dismiss"
        >
          {{ updateState.status === 'error' ? '关闭' : '稍后' }}
        </el-button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Download, Loading, CircleCheck, Warning } from '@element-plus/icons-vue'
import { useAutoUpdate } from '@/composables/useAutoUpdate'

const { updateState, downloadUpdate, installUpdate } = useAutoUpdate()

const showBanner = computed(() => {
  return ['available', 'downloading', 'downloaded', 'error'].includes(updateState.value.status)
})

function dismiss() {
  updateState.value = { status: 'idle' }
}
</script>

<style scoped>
.update-banner {
  position: fixed;
  bottom: 36px;
  right: 16px;
  z-index: 9999;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  background: var(--obsidian-bg-secondary);
  border: 1px solid var(--obsidian-border);
  border-radius: var(--radius-md);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  font-size: 13px;
  color: var(--obsidian-text-normal);
  max-width: 400px;
}

.update-banner.error {
  border-color: var(--el-color-danger-light-3);
}

.update-banner.downloaded {
  border-color: var(--el-color-success-light-3);
}

.update-banner-content {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.update-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.update-banner-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.update-slide-enter-active,
.update-slide-leave-active {
  transition: all 0.3s var(--ease-spring);
}

.update-slide-enter-from,
.update-slide-leave-to {
  opacity: 0;
  transform: translateY(16px);
}
</style>
