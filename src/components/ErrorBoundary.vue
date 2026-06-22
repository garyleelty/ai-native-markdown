<template>
  <div v-if="hasError" class="error-boundary">
    <div class="error-boundary-content">
      <div class="error-icon">
        <el-icon :size="48" color="var(--el-color-danger)">
          <WarningFilled />
        </el-icon>
      </div>
      <h2 class="error-title">遇到了一些问题</h2>
      <p class="error-description">
        应用的这个部分出现了错误。你可以尝试刷新页面，或者继续使用其他功能。
      </p>
      <div v-if="showDetails" class="error-details">
        <pre>{{ errorInfo }}</pre>
      </div>
      <div class="error-actions">
        <el-button type="primary" @click="handleReload">
          刷新页面
        </el-button>
        <el-button @click="handleRetry">
          重试
        </el-button>
        <el-button text @click="showDetails = !showDetails">
          {{ showDetails ? '隐藏' : '查看' }}详情
        </el-button>
      </div>
    </div>
  </div>
  <slot v-else />
</template>

<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue'
import { WarningFilled } from '@element-plus/icons-vue'

const hasError = ref(false)
const errorInfo = ref('')
const showDetails = ref(false)

onErrorCaptured((err, instance, info) => {
  hasError.value = true
  errorInfo.value = `${err.message}\n\nComponent: ${instance?.$options?.name || 'Unknown'}\nInfo: ${info}`
  // Log to console for debugging
  console.error('[ErrorBoundary]', err, info)
  // Prevent error from propagating further
  return false
})

function handleReload() {
  window.location.reload()
}

function handleRetry() {
  hasError.value = false
  errorInfo.value = ''
  showDetails.value = false
}
</script>

<style scoped>
.error-boundary {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  padding: 32px;
  background: var(--obsidian-bg-primary);
}

.error-boundary-content {
  max-width: 480px;
  text-align: center;
}

.error-icon {
  margin-bottom: 16px;
}

.error-title {
  margin: 0 0 8px;
  color: var(--obsidian-text-normal);
  font-size: 18px;
  font-weight: 600;
}

.error-description {
  margin: 0 0 20px;
  color: var(--obsidian-text-muted);
  font-size: 14px;
  line-height: 1.6;
}

.error-details {
  margin-bottom: 20px;
  padding: 12px;
  background: var(--obsidian-bg-secondary);
  border: 1px solid var(--obsidian-border);
  border-radius: var(--radius-md);
  text-align: left;
}

.error-details pre {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--obsidian-text-muted);
  white-space: pre-wrap;
  word-break: break-word;
}

.error-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
}
</style>
