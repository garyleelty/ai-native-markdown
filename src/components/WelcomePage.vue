<template>
  <div class="welcome-page">
    <div class="welcome-content">
      <section class="welcome-primary" aria-labelledby="welcome-title">
        <div class="welcome-logo">
          ✦
        </div>
        <p class="welcome-kicker">Your AI-powered creative space</p>
        <h1 id="welcome-title" class="welcome-title">AI Markdown</h1>
        <p class="welcome-subtitle">
          面向知识工作流的 Markdown 编辑器，把本地文件、实时预览、知识图谱和 AI 写作放在同一个工作台里。
        </p>

        <div class="welcome-actions">
          <el-button type="primary" native-type="button" size="large" @click="$emit('new-file')">
            <el-icon><DocumentAdd /></el-icon>
            新建文档
          </el-button>
          <el-button native-type="button" size="large" @click="$emit('open-folder')">
            <el-icon><FolderAdd /></el-icon>
            打开文件夹
          </el-button>
          <el-button native-type="button" size="large" @click="$emit('demo')">
            <el-icon><MagicStick /></el-icon>
            试用示例
          </el-button>
        </div>
      </section>

      <section class="welcome-panel" aria-labelledby="capabilities-title">
        <div class="section-heading">
          <h2 id="capabilities-title">已就绪能力</h2>
          <span>写作、连接、增强</span>
        </div>
        <div class="capability-grid">
          <div v-for="item in capabilities" :key="item.title" class="capability-item">
            <span class="capability-icon">
              <el-icon><component :is="item.icon" /></el-icon>
            </span>
            <span>
              <strong>{{ item.title }}</strong>
              <small>{{ item.desc }}</small>
            </span>
          </div>
        </div>
      </section>

      <section class="workflow-panel" aria-labelledby="workflow-title">
        <div class="section-heading">
          <h2 id="workflow-title">推荐工作流</h2>
          <span>从文件到知识网络</span>
        </div>
        <ol class="workflow-list">
          <li v-for="step in workflow" :key="step.title">
            <span class="step-index">{{ step.index }}</span>
            <span>
              <strong>{{ step.title }}</strong>
              <small>{{ step.desc }}</small>
            </span>
          </li>
        </ol>
      </section>

      <section v-if="recentFilesLoading" class="welcome-recent" aria-labelledby="recent-title">
        <div class="section-heading">
          <h2 id="recent-title">最近文件</h2>
          <span>加载中...</span>
        </div>
        <div class="recent-skeleton">
          <div v-for="i in 3" :key="i" class="recent-skeleton-item" />
        </div>
      </section>

      <section v-else-if="recentFiles.length > 0" class="welcome-recent" aria-labelledby="recent-title">
        <div class="section-heading">
          <h2 id="recent-title">最近文件</h2>
          <span>继续上次写作</span>
        </div>
        <button
          v-for="f in recentFiles"
          :key="f.path"
          type="button"
          class="recent-card"
          @click="$emit('open-file', f.path)"
        >
          <span class="recent-name">{{ f.name }}</span>
          <span class="recent-path">{{ f.path }}</span>
        </button>
      </section>

      <!-- 键盘快捷键提示 -->
      <section class="welcome-shortcuts" aria-labelledby="shortcuts-title">
        <div class="section-heading">
          <h2 id="shortcuts-title">快捷键</h2>
          <span>效率加倍</span>
        </div>
        <div class="shortcut-grid">
          <div v-for="shortcut in shortcuts" :key="shortcut.key" class="shortcut-item">
            <kbd class="shortcut-key">{{ shortcut.key }}</kbd>
            <span class="shortcut-desc">{{ shortcut.desc }}</span>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import {
  Collection,
  Connection,
  Cpu,
  Document,
  DocumentAdd,
  FolderAdd,
  MagicStick,
  Microphone,
} from '@element-plus/icons-vue'
import { recentFilesService, type RecentFileEntry } from '@/services/recentFiles'

defineEmits<{
  (e: 'new-file'): void
  (e: 'open-folder'): void
  (e: 'demo'): void
  (e: 'open-file', path: string): void
}>()

const recentFiles = ref<RecentFileEntry[]>([])
const recentFilesLoading = ref(true)

onMounted(async () => {
  recentFilesLoading.value = true
  try {
    recentFiles.value = (await recentFilesService.validateRecentFiles()).slice(0, 8)
  } finally {
    recentFilesLoading.value = false
  }
})

const capabilities = [
  { title: '本地工作区', desc: '导入、重命名、删除和导出 Markdown', icon: Collection },
  { title: '实时预览', desc: 'Mermaid、KaTeX 与 Wiki Link 导航', icon: Connection },
  { title: 'AI 写作', desc: 'Ollama 与 OpenAI-compatible Provider', icon: Cpu },
  { title: '多模态输入', desc: '语音输入、OCR、PDF 拖拽和知识图谱', icon: Microphone },
]

const workflow = [
  { index: '01', title: '选择工作区', desc: '打开本地文件夹或直接试用示例库' },
  { index: '02', title: '写 Markdown', desc: '源码、实时预览、阅读随时切换' },
  { index: '03', title: '连接笔记', desc: '用 Wiki Link、反链和图谱整理知识' },
  { index: '04', title: '用 AI 加速', desc: '基于当前内容继续写作和问答' },
]

// 键盘快捷键
const shortcuts = [
  { key: 'Ctrl/Cmd + P', desc: '命令面板' },
  { key: 'Ctrl/Cmd + B', desc: '粗体' },
  { key: 'Ctrl/Cmd + I', desc: '斜体' },
  { key: 'Ctrl/Cmd + K', desc: '插入链接' },
  { key: 'Ctrl/Cmd + S', desc: '保存' },
  { key: 'Ctrl/Cmd + F', desc: '查找替换' },
  { key: 'Ctrl/Cmd + H', desc: '替换模式' },
  { key: 'Ctrl/Cmd + Shift + H', desc: '版本历史' },
  { key: 'Ctrl/Cmd + 1-4', desc: '编辑器视图切换' },
  { key: 'F11', desc: '专注模式' },
]
</script>

<style scoped>
.welcome-page {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  background: var(--obsidian-bg-primary);
  color: var(--obsidian-text-normal);
}

.welcome-content {
  box-sizing: border-box;
  width: min(100%, 1040px);
  margin: 0 auto;
  padding: clamp(28px, 6vh, 64px) clamp(16px, 4vw, 40px);
  display: grid;
  grid-template-columns: minmax(260px, 1.08fr) minmax(260px, 0.92fr);
  grid-template-areas:
    "primary capabilities"
    "primary workflow"
    "shortcuts shortcuts"
    "recent recent";
  gap: 16px;
}

.welcome-primary,
.welcome-panel,
.workflow-panel,
.welcome-recent {
  border: 1px solid var(--obsidian-border);
  background: var(--obsidian-bg-secondary);
  border-radius: var(--radius-md);
}

.welcome-primary {
  grid-area: primary;
  min-height: 420px;
  padding: clamp(24px, 5vw, 44px);
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.welcome-panel {
  grid-area: capabilities;
  padding: 22px;
}

.workflow-panel {
  grid-area: workflow;
  padding: 22px;
}

.welcome-recent {
  grid-area: recent;
  padding: 18px;
}

.welcome-logo {
  width: 56px;
  height: 56px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 22px;
  font-size: 28px;
  background: var(--gradient-vivid);
  border: none;
  border-radius: var(--radius-md);
}

.welcome-kicker {
  margin: 0 0 8px;
  background: var(--gradient-vivid);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}

.welcome-title {
  margin: 0;
  color: var(--obsidian-text-normal);
  font-family: var(--font-sans);
  font-size: clamp(32px, 5vw, 52px);
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: 0;
}

.welcome-subtitle {
  max-width: 560px;
  margin: 18px 0 0;
  color: var(--obsidian-text-muted);
  font-size: 15px;
  line-height: 1.75;
}

.welcome-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 34px;
}

.welcome-actions .el-button {
  min-height: 44px !important;
  margin-left: 0 !important;
  padding: 0 18px !important;
  border-radius: var(--radius-sm) !important;
  font-family: var(--font-sans) !important;
  font-size: 14px !important;
  font-weight: 600 !important;
  box-shadow: none !important;
}

.welcome-actions .el-button .el-icon {
  margin-right: 5px;
}

.welcome-actions .el-button--primary {
  background: var(--obsidian-accent) !important;
  border-color: var(--obsidian-accent) !important;
  color: #fff !important;
}

.welcome-actions .el-button--primary:hover {
  background: var(--obsidian-accent-hover) !important;
  border-color: var(--obsidian-accent-hover) !important;
}

.welcome-actions .el-button:not(.el-button--primary) {
  background: transparent !important;
  border-color: var(--obsidian-border) !important;
  color: var(--obsidian-text-muted) !important;
}

.welcome-actions .el-button:not(.el-button--primary):hover {
  background: var(--obsidian-bg-hover) !important;
  border-color: var(--obsidian-text-faint) !important;
  color: var(--obsidian-text-normal) !important;
}

.section-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.section-heading h2 {
  margin: 0;
  color: var(--obsidian-text-normal);
  font-size: 15px;
  font-weight: 650;
  line-height: 1.3;
}

.section-heading span {
  color: var(--obsidian-text-faint);
  font-size: 12px;
  white-space: nowrap;
}

.capability-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.capability-item {
  min-width: 0;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px;
  background: var(--obsidian-bg-primary);
  border: 1px solid var(--obsidian-border);
  border-radius: var(--radius-sm);
}

.capability-icon {
  width: 30px;
  height: 30px;
  flex: 0 0 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: var(--gradient-cool);
  border-radius: var(--radius-sm);
}

.capability-item strong,
.workflow-list strong {
  display: block;
  color: var(--obsidian-text-normal);
  font-size: 13px;
  font-weight: 650;
  line-height: 1.35;
}

.capability-item small,
.workflow-list small {
  display: block;
  margin-top: 4px;
  color: var(--obsidian-text-faint);
  font-size: 12px;
  line-height: 1.45;
}

.workflow-list {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.workflow-list li {
  display: grid;
  grid-template-columns: 38px 1fr;
  gap: 10px;
  align-items: flex-start;
  padding: 10px 0;
  border-top: 1px solid var(--obsidian-border);
}

.workflow-list li:first-child {
  border-top: 0;
  padding-top: 0;
}

.step-index {
  background: var(--gradient-vivid);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 700;
}

.recent-card {
  width: 100%;
  min-height: 48px;
  display: block;
  margin-top: 8px;
  padding: 10px 12px;
  text-align: left;
  border: 1px solid var(--obsidian-border);
  background: var(--obsidian-bg-primary);
  color: inherit;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-default), border-color var(--duration-fast) var(--ease-default);
}

.recent-card:hover {
  border-color: var(--obsidian-text-faint);
  background: var(--obsidian-bg-hover);
}

.recent-name {
  display: block;
  color: var(--obsidian-text-normal);
  font-size: 13px;
  font-weight: 600;
}

.recent-path {
  display: block;
  margin-top: 2px;
  overflow: hidden;
  color: var(--obsidian-text-faint);
  font-family: var(--font-mono);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 键盘快捷键样式 */
.welcome-shortcuts {
  grid-column: 1 / -1;
  grid-area: shortcuts;
  padding: 18px;
  border: 1px solid var(--obsidian-border);
  background: var(--obsidian-bg-secondary);
  border-radius: var(--radius-md);
}

.shortcut-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 8px;
}

.shortcut-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: var(--obsidian-bg-primary);
  border: 1px solid var(--obsidian-border);
  border-radius: var(--radius-sm);
  transition: all 0.15s ease;
}

.shortcut-item:hover {
  border-color: var(--obsidian-accent);
  background: var(--obsidian-accent-soft);
}

.shortcut-key {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 60px;
  height: 22px;
  padding: 0 6px;
  background: var(--obsidian-bg-tertiary);
  border: 1px solid var(--obsidian-border);
  border-radius: var(--radius-xs);
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 500;
  color: var(--obsidian-text-muted);
}

.shortcut-item:hover .shortcut-key {
  border-color: var(--obsidian-accent);
  color: var(--obsidian-accent);
}

.shortcut-desc {
  font-size: 12px;
  color: var(--obsidian-text-muted);
  white-space: nowrap;
}

.shortcut-item:hover .shortcut-desc {
  color: var(--obsidian-text-normal);
}

.recent-skeleton {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.recent-skeleton-item {
  height: 48px;
  border-radius: var(--radius-sm);
  background: var(--obsidian-bg-primary);
  border: 1px solid var(--obsidian-border);
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}

@keyframes skeleton-pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
}

@media (max-width: 900px) {
  .welcome-content {
    grid-template-columns: 1fr;
    grid-template-areas:
      "primary"
      "capabilities"
      "workflow"
      "shortcuts"
      "recent";
  }

  .welcome-primary {
    min-height: 0;
  }
}

@media (max-width: 520px) {
  .welcome-content {
    padding: 18px 12px 28px;
    gap: 12px;
  }

  .welcome-primary,
  .welcome-panel,
  .workflow-panel,
  .welcome-recent {
    padding: 18px;
  }

  .welcome-logo {
    width: 48px;
    height: 48px;
    margin-bottom: 18px;
  }

  .welcome-subtitle {
    font-size: 14px;
  }

  .welcome-actions {
    display: grid;
    grid-template-columns: 1fr;
    margin-top: 24px;
  }

  .welcome-actions .el-button {
    width: 100%;
    justify-content: center;
  }

  .capability-grid {
    grid-template-columns: 1fr;
  }

  .section-heading {
    display: block;
  }

  .section-heading span {
    display: block;
    margin-top: 4px;
    white-space: normal;
  }
}
</style>
