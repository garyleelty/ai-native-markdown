<template>
  <div class="welcome-page">
    <div class="welcome-content">
      <div class="welcome-logo">
        <el-icon :size="48" color="var(--el-color-primary)"><Document /></el-icon>
      </div>
      <h1 class="welcome-title">AI Markdown</h1>
      <p class="welcome-subtitle">AI 原生 Markdown 编辑器，让写作更智能</p>

      <div class="welcome-actions">
        <el-button type="primary" size="large" @click="$emit('new-file')">
          <el-icon><DocumentAdd /></el-icon>
          新建文档
        </el-button>
        <el-button size="large" @click="$emit('open-folder')">
          <el-icon><FolderAdd /></el-icon>
          打开文件夹
        </el-button>
        <el-button size="large" @click="$emit('demo')">
          <el-icon><MagicStick /></el-icon>
          试用示例
        </el-button>
      </div>

      <el-divider>快捷键</el-divider>

      <div class="shortcuts-grid">
        <div class="shortcut-item" v-for="s in shortcuts" :key="s.keys">
          <kbd>{{ s.keys }}</kbd>
          <span>{{ s.desc }}</span>
        </div>
      </div>

      <div class="welcome-tip">{{ currentTip }}</div>

      <div class="welcome-recent" v-if="recentFiles.length > 0">
        <el-divider>最近文件</el-divider>
        <el-card
          v-for="f in recentFiles"
          :key="f.path"
          shadow="hover"
          class="recent-card"
          @click="$emit('open-file', f.path)"
        >
          <div class="recent-name">{{ f.name }}</div>
          <div class="recent-path">{{ f.path }}</div>
        </el-card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Document, DocumentAdd, FolderAdd, MagicStick } from '@element-plus/icons-vue'

defineEmits<{
  (e: 'new-file'): void
  (e: 'open-folder'): void
  (e: 'demo'): void
  (e: 'open-file', path: string): void
}>()

const recentFiles = ref<Array<{ name: string; path: string }>>([])

const shortcuts = [
  { keys: 'Ctrl+P', desc: '命令面板' },
  { keys: 'Ctrl+S', desc: '保存文件' },
  { keys: 'Ctrl+B', desc: '加粗' },
  { keys: 'Ctrl+I', desc: '斜体' },
  { keys: 'Ctrl+K', desc: '插入链接' },
  { keys: 'Ctrl+F', desc: '查找替换' },
]

const tips = [
  '💡 使用 Ctrl+P 打开命令面板，快速执行任何操作',
  '💡 试试 AI 续写功能，让灵感不断流',
  '💡 使用 [[WikiLink]] 创建文档间的关联',
  '💡 专注模式 (Ctrl+\\) 让你沉浸写作',
  '💡 拖放 Markdown 文件到窗口即可导入',
]

const currentTip = ref(tips[Math.floor(Math.random() * tips.length)])
</script>

<style scoped>
.welcome-page {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  overflow-y: auto;
  background: var(--obsidian-bg-primary);
}

.welcome-content {
  max-width: 480px;
  padding: 64px 24px;
  text-align: center;
}

.welcome-logo {
  margin-bottom: 20px;
}

.welcome-logo .el-icon {
  color: var(--obsidian-accent) !important;
  opacity: 0.7;
}

.welcome-title {
  font-family: var(--font-sans);
  font-size: 24px;
  font-weight: 600;
  color: var(--obsidian-text-normal);
  margin: 0 0 6px;
  letter-spacing: -0.02em;
}

.welcome-subtitle {
  font-size: 13px;
  color: var(--obsidian-text-muted);
  margin: 0 0 40px;
  line-height: 1.5;
}

.welcome-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 40px;
}

.welcome-actions .el-button {
  font-family: var(--font-sans) !important;
  font-size: 13px !important;
  font-weight: 500 !important;
  height: 36px !important;
  padding: 0 18px !important;
  border-radius: var(--radius-sm) !important;
  transition: all var(--duration-fast) var(--ease-default) !important;
  box-shadow: none !important;
}

.welcome-actions .el-button .el-icon {
  margin-right: 4px;
}

.welcome-actions .el-button--primary {
  background: var(--obsidian-accent) !important;
  border: none !important;
  color: #fff !important;
}

.welcome-actions .el-button--primary:hover {
  background: var(--obsidian-accent-hover) !important;
}

.welcome-actions .el-button--primary:active {
  background: var(--obsidian-accent) !important;
  opacity: 0.85;
}

.welcome-actions .el-button:not(.el-button--primary) {
  background: transparent !important;
  border: 1px solid var(--obsidian-border) !important;
  color: var(--obsidian-text-muted) !important;
}

.welcome-actions .el-button:not(.el-button--primary):hover {
  border-color: var(--obsidian-text-faint) !important;
  color: var(--obsidian-text-normal) !important;
  background: var(--obsidian-bg-hover) !important;
}

.welcome-actions .el-button:not(.el-button--primary):active {
  background: var(--obsidian-bg-active) !important;
}

.welcome-content :deep(.el-divider) {
  border-top-color: var(--obsidian-border) !important;
}

.welcome-content :deep(.el-divider__text) {
  background: var(--obsidian-bg-primary) !important;
  color: var(--obsidian-text-faint) !important;
  font-size: 11px !important;
  font-weight: 500 !important;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 0 16px !important;
}

.shortcuts-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 32px;
  text-align: left;
  margin-top: 16px;
}

.shortcut-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: var(--obsidian-text-muted);
  padding: 3px 0;
}

kbd {
  background: var(--obsidian-bg-secondary);
  border: 1px solid var(--obsidian-border);
  border-radius: var(--radius-xs);
  padding: 2px 8px;
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--obsidian-text-faint);
  min-width: 56px;
  text-align: center;
  line-height: 1.6;
}

.welcome-tip {
  margin-top: 32px;
  font-size: 12px;
  color: var(--obsidian-text-faint);
  line-height: 1.5;
}

.welcome-recent {
  margin-top: 32px;
}

.recent-card {
  cursor: pointer;
  margin-bottom: 4px;
  text-align: left;
  border: 1px solid var(--obsidian-border) !important;
  background: transparent !important;
  box-shadow: none !important;
  border-radius: var(--radius-sm) !important;
  transition: all var(--duration-fast) var(--ease-default) !important;
}

.recent-card:hover {
  border-color: var(--obsidian-text-faint) !important;
  background: var(--obsidian-bg-hover) !important;
}

.recent-card:active {
  background: var(--obsidian-bg-active) !important;
}

.recent-card :deep(.el-card__body) {
  padding: 8px 14px !important;
}

.recent-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--obsidian-text-normal);
}

.recent-path {
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--obsidian-text-faint);
  margin-top: 2px;
}
</style>
