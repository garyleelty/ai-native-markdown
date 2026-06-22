<template>
  <div class="panel">
    <div class="panel-header">
      <span class="panel-title">设置</span>
    </div>

    <el-collapse v-model="activeSettingSections" class="settings-list">
      <el-collapse-item name="appearance">
        <template #title>
          <span class="setting-section-title">外观</span>
          <span class="setting-section-desc">主题与工作台入口</span>
        </template>
      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-label">外观主题</span>
          <span class="setting-desc">{{ themeLabel }}</span>
        </div>
        <el-radio-group
          :model-value="settingsStore.theme"
          size="small"
          @change="handleThemeChange"
        >
          <el-radio-button value="light">浅色</el-radio-button>
          <el-radio-button value="dark">深色</el-radio-button>
          <el-radio-button value="system">系统</el-radio-button>
        </el-radio-group>
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

      </el-collapse-item>

      <el-collapse-item name="editor">
        <template #title>
          <span class="setting-section-title">编辑器</span>
          <span class="setting-section-desc">字体、排版与保存行为</span>
        </template>
      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-label">字体大小</span>
          <span class="setting-desc">{{ settingsStore.editorFontSize }}px</span>
        </div>
        <el-slider
          :model-value="settingsStore.editorFontSize"
          :min="12"
          :max="24"
          :step="1"
          :show-tooltip="false"
          style="width: 120px; margin-left: 12px;"
          @change="(val: number | number[]) => settingsStore.setEditorFontSize(Number(val))"
        />
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-label">行高</span>
          <span class="setting-desc">{{ settingsStore.editorLineHeight.toFixed(1) }}</span>
        </div>
        <el-slider
          :model-value="settingsStore.editorLineHeight"
          :min="1.2"
          :max="3.0"
          :step="0.1"
          :show-tooltip="false"
          style="width: 120px; margin-left: 12px;"
          @change="(val: number | number[]) => settingsStore.setEditorLineHeight(Number(val))"
        />
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-label">字体</span>
          <span class="setting-desc">编辑器等宽字体</span>
        </div>
        <el-select
          :model-value="settingsStore.editorFontFamily"
          style="width: 160px;"
          @change="(val: string | number | boolean | Record<string, string>) => settingsStore.setEditorFontFamily(String(val))"
        >
          <el-option label="默认等宽" value="var(--font-mono)" />
          <el-option label="JetBrains Mono" value="'JetBrains Mono', monospace" />
          <el-option label="Fira Code" value="'Fira Code', monospace" />
          <el-option label="Source Code Pro" value="'Source Code Pro', monospace" />
          <el-option label="Cascadia Code" value="'Cascadia Code', monospace" />
          <el-option label="Menlo" value="Menlo, monospace" />
          <el-option label="Consolas" value="Consolas, monospace" />
          <el-option label="monospace" value="monospace" />
        </el-select>
      </div>

      </el-collapse-item>

      <el-collapse-item name="ai">
        <template #title>
          <span class="setting-section-title">AI</span>
          <span class="setting-section-desc">写作增强与补全能力</span>
        </template>
      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-label">知识库增强问答</span>
          <span class="setting-desc">回答时引用当前工作区内容</span>
        </div>
        <el-switch
          :model-value="settingsStore.enableRAG"
          @change="(value: string | number | boolean) => settingsStore.setEnableRAG(Boolean(value))"
        />
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-label">AI 行内操作</span>
          <span class="setting-desc">在编辑器中启用 AI 快捷动作</span>
        </div>
        <el-switch
          :model-value="settingsStore.enableAIActions"
          @change="(value: string | number | boolean) => settingsStore.setEnableAIActions(Boolean(value))"
        />
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-label">智能粘贴</span>
          <span class="setting-desc">清理文本并转换富文本为 Markdown</span>
        </div>
        <el-switch
          :model-value="settingsStore.enableSmartPaste"
          @change="(value: string | number | boolean) => settingsStore.setEnableSmartPaste(Boolean(value))"
        />
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-label">行内编辑</span>
          <span class="setting-desc">允许选中文本后触发局部改写</span>
        </div>
        <el-switch
          :model-value="settingsStore.enableInlineEdit"
          @change="(value: string | number | boolean) => settingsStore.setEnableInlineEdit(Boolean(value))"
        />
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-label">智能补全</span>
          <span class="setting-desc">AI 自动补全建议（Alt+\ 切换）</span>
        </div>
        <el-switch
          :model-value="settingsStore.ghostTextConfig.enabled"
          @change="(value: string | number | boolean) => settingsStore.setGhostTextConfig({ ...settingsStore.ghostTextConfig, enabled: Boolean(value) })"
        />
      </div>

      </el-collapse-item>

      <el-collapse-item name="advanced">
        <template #title>
          <span class="setting-section-title">高级</span>
          <span class="setting-section-desc">自动保存与连接配置</span>
        </template>
      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-label">自动保存延迟</span>
          <span class="setting-desc">{{ settingsStore.autoSaveDelay }}ms</span>
        </div>
        <el-slider
          :model-value="settingsStore.autoSaveDelay"
          :min="500"
          :max="10000"
          :step="500"
          :show-tooltip="false"
          style="width: 120px; margin-left: 12px;"
          @change="(val: number | number[]) => settingsStore.setAutoSaveDelay(Number(val))"
        />
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-label">自动换行</span>
          <span class="setting-desc">长行自动折行显示</span>
        </div>
        <el-switch
          :model-value="settingsStore.wordWrap"
          @change="(value: string | number | boolean) => settingsStore.setWordWrap(Boolean(value))"
        />
      </div>

      <div class="setting-subsection-title">AI 连接配置</div>
      <slot name="ai-config" />
      </el-collapse-item>

      <el-collapse-item name="plugins">
        <template #title>
          <span class="setting-section-title">插件</span>
          <span class="setting-section-desc">管理功能插件</span>
        </template>
        <PluginSettings />
      </el-collapse-item>
    </el-collapse>

    <div class="settings-footer">
      <el-card shadow="never" class="about-card">
        <div class="about-brand">AI Markdown</div>
        <div class="about-version">v{{ version }}</div>
        <div class="about-desc">AI 原生 Markdown 编辑器，让写作更智能。</div>
      </el-card>
      <el-button
        type="danger"
        plain
        size="small"
        class="reset-btn"
        @click="handleResetDefaults"
      >
        恢复默认设置
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessageBox, ElMessage } from 'element-plus'
import { useSettingsStore } from '@/stores/settings'
import PluginSettings from '@/components/PluginSettings.vue'
import type { ThemeMode } from '@/types'
import version from '@/version'

interface Props {
  isDark?: boolean
  showAI?: boolean
}
withDefaults(defineProps<Props>(), { isDark: true, showAI: false })

const emit = defineEmits<{
  (e: 'set-theme', dark: boolean): void
  (e: 'toggle-ai'): void
}>()

const settingsStore = useSettingsStore()
const activeSettingSections = ref(['appearance', 'editor'])

const themeLabel = computed(() => {
  const map: Record<ThemeMode, string> = {
    light: '浅色模式',
    dark: '深色模式',
    system: '跟随系统',
  }
  return map[settingsStore.theme] || '跟随系统'
})

const handleThemeChange = (val: string | number | boolean | Record<string, string>) => {
  const mode = String(val) as ThemeMode
  settingsStore.setTheme(mode)
}

const handleResetDefaults = async () => {
  try {
    await ElMessageBox.confirm(
      '此操作将恢复所有设置为默认值（AI 连接配置除外），是否继续？',
      '恢复默认设置',
      { type: 'warning', confirmButtonText: '确认恢复', cancelButtonText: '取消' }
    )
    settingsStore.resetToDefaults()
    ElMessage.success('已恢复默认设置')
  } catch {
    // 用户取消
  }
}
</script>

<style scoped>
.panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--obsidian-bg-secondary);
}

.panel-header {
  padding: 10px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--obsidian-border);
  flex-shrink: 0;
}

.panel-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--obsidian-text-muted);
  letter-spacing: 0;
  text-transform: uppercase;
}

.settings-list {
  padding: 4px 0;
  flex: 1;
  overflow-y: auto;
  border: none;
}

.settings-list :deep(.el-collapse-item__header) {
  min-height: 42px;
  height: auto;
  padding: 0 12px;
  background: transparent;
  border-bottom: 1px solid var(--obsidian-border);
  color: var(--obsidian-text-normal);
}

.settings-list :deep(.el-collapse-item__wrap) {
  background: transparent;
  border-bottom: 1px solid var(--obsidian-border);
}

.settings-list :deep(.el-collapse-item__content) {
  padding-bottom: 4px;
}

.settings-footer {
  flex-shrink: 0;
  border-top: 1px solid var(--obsidian-border);
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  transition: background 0.1s ease;
}

.setting-row:hover {
  background: var(--obsidian-bg-hover);
}

.setting-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.setting-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--obsidian-text-normal);
}

.setting-desc {
  font-size: 11px;
  color: var(--obsidian-text-faint);
}

.setting-section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--obsidian-text-normal);
  letter-spacing: 0;
}

.setting-section-desc {
  margin-left: 8px;
  font-size: 11px;
  font-weight: 400;
  color: var(--obsidian-text-faint);
}

.setting-subsection-title {
  font-size: 10px;
  font-weight: 600;
  color: var(--obsidian-text-faint);
  letter-spacing: 0;
  text-transform: uppercase;
  padding: 12px 12px 6px;
}

.about-card {
  margin: 4px 12px 12px;
  background: var(--obsidian-bg-primary) !important;
  border: 1px solid var(--obsidian-border) !important;
  box-shadow: none !important;
  border-radius: 4px;
}

.about-card :deep(.el-card__body) {
  padding: 10px 12px;
}

.about-brand {
  font-size: 15px;
  font-weight: 600;
  color: var(--obsidian-accent);
  margin-bottom: 2px;
}

.about-version {
  font-size: 11px;
  color: var(--obsidian-text-faint);
  font-weight: 500;
  margin-bottom: 6px;
}

.about-desc {
  font-size: 12px;
  color: var(--obsidian-text-muted);
  line-height: 1.5;
}

.reset-btn {
  display: block;
  width: calc(100% - 24px);
  margin: 8px 12px 12px;
}
</style>
