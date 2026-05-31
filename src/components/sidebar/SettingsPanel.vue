<template>
  <div class="panel">
    <div class="panel-header">
      <span class="panel-title">设置</span>
    </div>

    <div class="settings-list">
      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-label">外观主题</span>
          <span class="setting-desc">{{ isDark ? '深色模式' : '浅色模式' }}</span>
        </div>
        <el-switch
          :model-value="isDark"
          @change="$emit('toggle-theme')"
          active-text="暗"
          inactive-text="亮"
        />
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-label">AI 助手</span>
          <span class="setting-desc">内嵌辅助写作</span>
        </div>
        <el-switch
          :model-value="showAI"
          @change="$emit('toggle-ai')"
        />
      </div>

      <el-divider />

      <div class="setting-section-title">关于</div>
      <el-card shadow="never" class="about-card">
        <div class="about-brand">AI Markdown</div>
        <div class="about-version">v0.2.0</div>
        <div class="about-desc">AI 原生 Markdown 编辑器，让写作更智能。</div>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  isDark?: boolean
  showAI?: boolean
}
withDefaults(defineProps<Props>(), { isDark: true, showAI: false })

defineEmits<{
  (e: 'toggle-theme'): void
  (e: 'toggle-ai'): void
}>()
</script>

<style scoped>
.panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--obsidian-bg-secondary, #252525);
}

.panel-header {
  padding: 10px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--obsidian-border, rgba(255, 255, 255, 0.06));
  flex-shrink: 0;
}

.panel-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--obsidian-text-muted, #999);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.settings-list {
  padding: 4px 0;
  flex: 1;
  overflow-y: auto;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  transition: background 0.1s ease;
}

.setting-row:hover {
  background: var(--obsidian-bg-hover, #303030);
}

.setting-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.setting-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--obsidian-text-normal, #dcddde);
}

.setting-desc {
  font-size: 11px;
  color: var(--obsidian-text-faint, #666);
}

.setting-section-title {
  font-size: 10px;
  font-weight: 600;
  color: var(--obsidian-text-faint, #666);
  letter-spacing: 0.5px;
  text-transform: uppercase;
  padding: 10px 12px 6px;
}

.about-card {
  margin: 4px 12px 12px;
  background: var(--obsidian-bg-primary, #1e1e1e) !important;
  border: 1px solid var(--obsidian-border, rgba(255, 255, 255, 0.06)) !important;
  box-shadow: none !important;
  border-radius: 4px;
}

.about-card :deep(.el-card__body) {
  padding: 10px 12px;
}

.about-brand {
  font-size: 15px;
  font-weight: 600;
  color: var(--obsidian-accent, #7f6df2);
  margin-bottom: 2px;
}

.about-version {
  font-size: 11px;
  color: var(--obsidian-text-faint, #666);
  font-weight: 500;
  margin-bottom: 6px;
}

.about-desc {
  font-size: 12px;
  color: var(--obsidian-text-muted, #999);
  line-height: 1.5;
}
</style>
