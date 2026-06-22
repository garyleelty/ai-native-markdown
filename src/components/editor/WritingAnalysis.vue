<template>
  <div class="writing-analysis">
    <div class="analysis-header">
      <el-icon><DataAnalysis /></el-icon>
      <span>写作分析</span>
      <el-button
        :icon="Refresh"
        native-type="button"
        size="small"
        circle
        aria-label="刷新分析"
        @click="$emit('refresh')"
        :loading="isAnalyzing"
      />
    </div>

    <div v-if="metrics" class="metrics-grid">
      <!-- Readability Score -->
      <div class="metric-card readability">
        <div class="metric-header">
          <span class="metric-label">可读性</span>
          <span class="metric-badge" :class="readabilityClass">{{ readabilityLevel }}</span>
        </div>
        <div class="metric-value">
          <span class="score">{{ readabilityScore }}</span>
          <span class="score-unit">/100</span>
        </div>
        <div class="score-bar">
          <div class="score-fill" :style="{ width: readabilityScore + '%' }" :class="readabilityClass" />
        </div>
      </div>

      <!-- Basic Stats -->
      <div class="metric-card stats">
        <div class="stat-row">
          <span class="stat-label">词数</span>
          <span class="stat-value">{{ wordCount }}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">字符</span>
          <span class="stat-value">{{ charCount }}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">句子</span>
          <span class="stat-value">{{ sentenceCount }}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">段落</span>
          <span class="stat-value">{{ paragraphCount }}</span>
        </div>
      </div>

      <!-- Advanced Metrics -->
      <div class="metric-card advanced">
        <div class="metric-header">
          <span class="metric-label">详细指标</span>
        </div>
        <div class="advanced-metrics">
          <div class="advanced-metric">
            <span class="metric-name">平均句长</span>
            <span class="metric-value">{{ metrics.avgWordsPerSentence }} 词</span>
          </div>
          <div class="advanced-metric">
            <span class="metric-name">被动语态</span>
            <span class="metric-value" :class="{ warning: metrics.passiveVoicePercentage > 20 }">
              {{ metrics.passiveVoicePercentage }}%
            </span>
          </div>
          <div class="advanced-metric">
            <span class="metric-name">副词比例</span>
            <span class="metric-value" :class="{ warning: metrics.adverbPercentage > 10 }">
              {{ metrics.adverbPercentage }}%
            </span>
          </div>
          <div class="advanced-metric">
            <span class="metric-name">复杂词汇</span>
            <span class="metric-value" :class="{ warning: metrics.complexWordPercentage > 15 }">
              {{ metrics.complexWordPercentage }}%
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Suggestions -->
    <div v-if="suggestions.length > 0" class="suggestions-section">
      <div class="suggestions-header">
        <span>改进建议</span>
        <span class="suggestion-count">{{ suggestions.length }}</span>
      </div>
      <div class="suggestions-list">
        <div
          v-for="(suggestion, index) in suggestions"
          :key="index"
          class="suggestion-item"
          :class="suggestion.severity"
        >
          <el-icon class="suggestion-icon">
            <InfoFilled v-if="suggestion.severity === 'info'" />
            <WarningFilled v-else-if="suggestion.severity === 'warning'" />
            <MagicStick v-else />
          </el-icon>
          <div class="suggestion-content">
            <span class="suggestion-type">{{ getTypeLabel(suggestion.type) }}</span>
            <span class="suggestion-message">{{ suggestion.message }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="!isAnalyzing && metrics" class="no-suggestions">
      <el-icon><CircleCheck /></el-icon>
      <span>写作质量良好！</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Refresh, DataAnalysis, InfoFilled, WarningFilled, MagicStick, CircleCheck } from '@element-plus/icons-vue'
import type { WritingMetrics, WritingSuggestion } from '@/composables/useWritingAnalysis'

const props = defineProps<{
  isAnalyzing: boolean
  metrics: WritingMetrics | null
  suggestions: WritingSuggestion[]
  wordCount: number
  charCount: number
  sentenceCount: number
  paragraphCount: number
  readabilityScore: number
  readabilityLevel: string
}>()

defineEmits<{
  (e: 'refresh'): void
}>()

const readabilityClass = computed(() => {
  const score = props.readabilityScore
  if (score >= 70) return 'good'
  if (score >= 50) return 'medium'
  return 'hard'
})

const getTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    grammar: '语法',
    style: '风格',
    clarity: '清晰度',
    engagement: '吸引力',
  }
  return labels[type] || type
}
</script>

<style scoped>
.writing-analysis {
  padding: 12px;
}

.analysis-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  font-size: 13px;
  font-weight: 600;
  color: var(--obsidian-text-normal);
}

.analysis-header .el-icon {
  font-size: 16px;
  color: var(--obsidian-accent);
}

.analysis-header .el-button {
  margin-left: auto;
}

.metrics-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.metric-card {
  background: var(--obsidian-bg-primary);
  border: 1px solid var(--obsidian-border);
  border-radius: var(--radius-md);
  padding: 12px;
}

.metric-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.metric-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--obsidian-text-muted);
}

.metric-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: var(--radius-full);
}

.metric-badge.good {
  background: var(--success-dim);
  color: var(--success);
}

.metric-badge.medium {
  background: var(--warning-dim);
  color: var(--warning);
}

.metric-badge.hard {
  background: var(--error-dim);
  color: var(--error);
}

.metric-value {
  margin-bottom: 8px;
}

.score {
  font-size: 28px;
  font-weight: 700;
  color: var(--obsidian-text-normal);
  line-height: 1;
}

.score-unit {
  font-size: 14px;
  color: var(--obsidian-text-faint);
  margin-left: 2px;
}

.score-bar {
  height: 4px;
  background: var(--obsidian-bg-hover);
  border-radius: 2px;
  overflow: hidden;
}

.score-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s var(--ease-spring);
}

.score-fill.good {
  background: var(--success);
}

.score-fill.medium {
  background: var(--warning);
}

.score-fill.hard {
  background: var(--error);
}

.stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
}

.stat-label {
  font-size: 12px;
  color: var(--obsidian-text-muted);
}

.stat-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--obsidian-text-normal);
}

.advanced-metrics {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.advanced-metric {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
}

.metric-name {
  font-size: 12px;
  color: var(--obsidian-text-muted);
}

.metric-value {
  font-size: 12px;
  font-weight: 500;
  color: var(--obsidian-text-normal);
}

.metric-value.warning {
  color: var(--warning);
}

.suggestions-section {
  margin-top: 16px;
}

.suggestions-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--obsidian-text-muted);
}

.suggestion-count {
  background: var(--obsidian-accent-soft);
  color: var(--obsidian-accent);
  padding: 1px 6px;
  border-radius: var(--radius-full);
  font-size: 10px;
}

.suggestions-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.suggestion-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px;
  background: var(--obsidian-bg-primary);
  border: 1px solid var(--obsidian-border);
  border-radius: var(--radius-sm);
  transition: all 0.15s var(--ease-spring);
}

.suggestion-item:hover {
  border-color: var(--obsidian-accent);
  background: var(--obsidian-accent-soft);
}

.suggestion-icon {
  font-size: 14px;
  flex-shrink: 0;
  margin-top: 1px;
}

.suggestion-item.info .suggestion-icon {
  color: var(--info);
}

.suggestion-item.warning .suggestion-icon {
  color: var(--warning);
}

.suggestion-item.suggestion .suggestion-icon {
  color: var(--obsidian-accent);
}

.suggestion-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.suggestion-type {
  font-size: 10px;
  font-weight: 600;
  color: var(--obsidian-text-faint);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.suggestion-message {
  font-size: 12px;
  color: var(--obsidian-text-normal);
  line-height: 1.4;
}

.no-suggestions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px;
  color: var(--success);
  font-size: 13px;
}

.no-suggestions .el-icon {
  font-size: 16px;
}
</style>
