<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    :show-close="false"
    width="480px"
    top="clamp(24px, 12vh, 96px)"
    class="command-palette-dialog responsive-dialog"
    aria-label="命令面板"
    :append-to-body="true"
    destroy-on-close
  >
    <div class="command-palette">
      <el-input
        ref="inputRef"
        v-model="searchQuery"
        :placeholder="isAIMode ? '告诉 AI 你想做什么...' : '输入命令或用 > 开启 AI 模式...'"
        size="large"
        clearable
        aria-label="搜索命令"
        @keydown.down.prevent="navigateDown"
        @keydown.up.prevent="navigateUp"
        @keydown.enter.prevent="isNaturalLanguage ? executeAI() : executeSelected()"
        @keydown.escape="$emit('update:modelValue', false)"
        role="combobox"
        aria-controls="command-palette-list"
        :aria-expanded="modelValue"
        :aria-activedescendant="selectedCommandId ? `command-${safeCommandId(selectedCommandId)}` : undefined"
      >
        <template #prefix>
          <el-icon v-if="isNaturalLanguage"><MagicStick /></el-icon>
          <el-icon v-else><Search /></el-icon>
        </template>
        <template #append>
          <el-button
            :type="isAIMode ? 'primary' : 'default'"
            @click="isAIMode = !isAIMode"
            :icon="MagicStick"
            aria-label="切换 AI 模式"
          />
        </template>
      </el-input>

      <el-scrollbar max-height="360px" class="command-list-scroll">
        <div id="command-palette-list" role="listbox" aria-label="命令列表">
          <div v-for="category in filteredCategories" :key="category.label" class="command-category">
            <div class="category-label">{{ category.label }}</div>
            <button
              v-for="cmd in category.commands"
              :key="cmd.id"
              :id="`command-${safeCommandId(cmd.id)}`"
              type="button"
              role="option"
              :aria-selected="cmd.id === selectedCommandId"
              class="command-item"
              :class="{ active: cmd.id === selectedCommandId }"
              @click="executeCommand(cmd.id)"
              @mouseenter="selectedCommandId = cmd.id"
            >
              <el-icon><component :is="cmd.icon" /></el-icon>
              <span class="command-label-group">
                <span class="command-label">{{ cmd.label }}</span>
                <span v-if="cmd.description" class="command-description">{{ cmd.description }}</span>
              </span>
              <span v-if="cmd.shortcut" class="command-shortcut">{{ cmd.shortcut }}</span>
            </button>
          </div>
        </div>
        <div v-if="flatFilteredCommands.length === 0 && !isNaturalLanguage" class="command-empty">
          未找到匹配的命令
        </div>

        <!-- AI Mode -->
        <div v-if="isNaturalLanguage" class="ai-mode-section">
          <div class="ai-mode-header">
            <el-icon><MagicStick /></el-icon>
            <span>AI 执行</span>
            <span class="ai-mode-hint">按 Enter 执行</span>
          </div>
          <button
            type="button"
            class="ai-mode-item"
            @click="executeAI"
            :disabled="aiProcessing"
          >
            <el-icon><Promotion /></el-icon>
            <span class="ai-mode-prompt">{{ aiPrompt }}</span>
            <span v-if="aiProcessing" class="ai-processing">处理中...</span>
          </button>
          <div class="ai-mode-examples">
            <span>示例：</span>
            <button type="button" class="ai-example" @click="searchQuery = '> 把这篇文章改写成更正式的语气'">改写语气</button>
            <button type="button" class="ai-example" @click="searchQuery = '> 总结当前笔记的要点'">总结要点</button>
            <button type="button" class="ai-example" @click="searchQuery = '> 创建一个关于机器学习的笔记'">创建笔记</button>
          </div>
        </div>
      </el-scrollbar>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import {
  Search, DocumentAdd, FolderAdd, FolderOpened, Check,
  Download, EditPen, Edit, Document, Link, Picture,
  Expand, ChatDotRound, View, Sunny,
  Delete, Connection, Grid, Monitor, Clock, FullScreen, Notebook, Calendar,
  Setting, List, Share, Refresh, Tickets, MagicStick, Promotion
} from '@element-plus/icons-vue'

const props = defineProps<{
  modelValue: boolean
  markdownPaths?: string[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'execute', command: string): void
  (e: 'ai-execute', prompt: string): void
}>()

const isAIMode = ref(false)
const aiProcessing = ref(false)

interface Command {
  id: string
  label: string
  icon: any
  shortcut?: string
  description?: string
  category: string
}

const commands: Command[] = [
  { id: 'file.new', label: '新建文件', icon: DocumentAdd, shortcut: 'Ctrl+N', category: '文件' },
  { id: 'file.new-folder', label: '新建文件夹', icon: FolderAdd, category: '文件' },
  { id: 'file.open', label: '打开文件夹', icon: FolderOpened, category: '文件' },
  { id: 'file.save', label: '保存', icon: Check, shortcut: 'Ctrl+S', category: '文件' },
  { id: 'file.daily-note', label: '今日笔记', icon: Calendar, category: '文件' },
  { id: 'file.version-history', label: '版本历史', icon: Clock, shortcut: 'Ctrl+Shift+H', category: '文件' },
  { id: 'file.new-from-template', label: '从模板新建', icon: Grid, category: '文件' },
  { id: 'file.export-md', label: '导出 Markdown', icon: Download, category: '文件' },
  { id: 'file.export-html', label: '导出 HTML', icon: Download, category: '文件' },
  { id: 'search.file-name', label: '搜索文件名', icon: Search, category: '搜索' },
  { id: 'search.content', label: '全局内容搜索', icon: Search, category: '搜索' },
  { id: 'edit.bold', label: '粗体', icon: EditPen, shortcut: 'Ctrl+B', category: '编辑' },
  { id: 'edit.italic', label: '斜体', icon: Edit, shortcut: 'Ctrl+I', category: '编辑' },
  { id: 'edit.strikethrough', label: '删除线', icon: Edit, category: '编辑' },
  { id: 'edit.heading1', label: '标题 1', icon: Document, category: '编辑' },
  { id: 'edit.heading2', label: '标题 2', icon: Document, category: '编辑' },
  { id: 'edit.heading3', label: '标题 3', icon: Document, category: '编辑' },
  { id: 'edit.code-block', label: '代码块', icon: Monitor, category: '编辑' },
  { id: 'edit.link', label: '链接', icon: Link, category: '编辑' },
  { id: 'edit.image', label: '图片', icon: Picture, category: '编辑' },
  { id: 'view.sidebar', label: '切换侧边栏', icon: Expand, category: '视图' },
  { id: 'view.ai-panel', label: '切换 AI 面板', icon: ChatDotRound, category: '视图' },
  { id: 'view.graph-workbench', label: '切换图谱工作区', icon: Share, category: '视图' },
  { id: 'view.right-dock', label: '切换右侧工作台', icon: Tickets, category: '视图' },
  { id: 'view.files-panel', label: '打开文件面板', icon: FolderOpened, category: '视图' },
  { id: 'view.knowledge-panel', label: '打开知识面板', icon: Share, category: '视图' },
  { id: 'view.ai-settings', label: '打开 AI 设置', icon: Connection, category: '视图' },
  { id: 'view.outline', label: '打开文档大纲', icon: List, category: '视图' },
  { id: 'view.settings', label: '打开设置', icon: Setting, category: '视图' },
  { id: 'view.source', label: '源码模式', icon: EditPen, category: '视图' },
  { id: 'view.live-preview', label: '实时预览模式', icon: View, category: '视图' },
  { id: 'view.preview', label: '阅读模式', icon: View, category: '视图' },
  { id: 'view.theme', label: '切换主题', icon: Sunny, category: '视图' },
  { id: 'view.focus-mode', label: '专注模式', icon: FullScreen, shortcut: 'F11', category: '视图' },
  { id: 'view.cheatsheet', label: 'Markdown 速查表', icon: Notebook, category: '视图' },
  { id: 'knowledge.refresh-index', label: '刷新知识索引', icon: Refresh, category: '知识' },
  { id: 'knowledge.migration-audit', label: '迁移校验', icon: List, category: '知识' },
  { id: 'ai.clear', label: '清空对话', icon: Delete, category: 'AI' },
  { id: 'ai.test', label: '测试连接', icon: Connection, category: 'AI' },
]

const categoryOrder = [
  { label: '文件', key: '文件' },
  { label: '笔记', key: '笔记' },
  { label: '搜索', key: '搜索' },
  { label: '编辑', key: '编辑' },
  { label: '视图', key: '视图' },
  { label: '知识', key: '知识' },
  { label: 'AI', key: 'AI' },
]

const searchQuery = ref('')
const selectedCommandId = ref('')

// Auto-detect AI mode when > is typed
watch(searchQuery, (q) => {
  if (q.startsWith('>')) {
    isAIMode.value = true
  }
})

const getFileName = (path: string) => path.split('/').pop() || path
const getNoteTitle = (path: string) => getFileName(path).replace(/\.(md|markdown)$/i, '')

const noteCommands = computed<Command[]>(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return []

  return (props.markdownPaths || [])
    .filter(path => {
      const title = getNoteTitle(path).toLowerCase()
      return title.includes(q) || path.toLowerCase().includes(q)
    })
    .sort((a, b) => {
      const aTitle = getNoteTitle(a).toLowerCase()
      const bTitle = getNoteTitle(b).toLowerCase()
      const aStarts = aTitle.startsWith(q) ? 0 : 1
      const bStarts = bTitle.startsWith(q) ? 0 : 1
      if (aStarts !== bStarts) return aStarts - bStarts
      return aTitle.localeCompare(bTitle)
    })
    .slice(0, 8)
    .map(path => ({
      id: `file.quick-open:${path}`,
      label: getNoteTitle(path),
      description: path,
      icon: Document,
      category: '笔记',
    }))
})

const searchableCommands = computed(() => [...commands, ...noteCommands.value])

const commandMatches = (cmd: Command, query: string) => {
  if (query === '') return true

  const q = query.toLowerCase()

  // 精确包含匹配
  if (
    [cmd.label, cmd.id, cmd.description || '', cmd.shortcut || '']
      .some(value => value.toLowerCase().includes(q))
  ) return true

  // 模糊匹配：查询字符按顺序出现在标签中
  const label = cmd.label.toLowerCase()
  let qi = 0
  for (let li = 0; li < label.length && qi < q.length; li++) {
    if (label[li] === q[qi]) qi++
  }
  if (qi === q.length) return true

  return false
}

const filteredCategories = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return categoryOrder
    .map(cat => ({
      ...cat,
      commands: searchableCommands.value.filter(
        cmd => cmd.category === cat.key && commandMatches(cmd, q)
      )
    }))
    .filter(cat => cat.commands.length > 0)
})

const flatFilteredCommands = computed(() =>
  filteredCategories.value.flatMap(cat => cat.commands)
)

// AI mode detection - if query starts with > or is natural language
const isNaturalLanguage = computed(() => {
  const q = searchQuery.value.trim()
  if (!q) return false
  // Starts with > for explicit AI mode
  if (q.startsWith('>')) return true
  // If no commands match and query is long enough, suggest AI mode
  if (flatFilteredCommands.value.length === 0 && q.length > 5) return true
  return false
})

const aiPrompt = computed(() => {
  const q = searchQuery.value.trim()
  return q.startsWith('>') ? q.slice(1).trim() : q
})

watch(flatFilteredCommands, (cmds) => {
  if (cmds.length > 0 && !cmds.find(c => c.id === selectedCommandId.value)) {
    selectedCommandId.value = cmds[0].id
  }
}, { immediate: true })

const navigateDown = () => {
  const cmds = flatFilteredCommands.value
  const idx = cmds.findIndex(c => c.id === selectedCommandId.value)
  if (idx < cmds.length - 1) {
    selectedCommandId.value = cmds[idx + 1].id
  }
}

const navigateUp = () => {
  const cmds = flatFilteredCommands.value
  const idx = cmds.findIndex(c => c.id === selectedCommandId.value)
  if (idx > 0) {
    selectedCommandId.value = cmds[idx - 1].id
  }
}

const executeSelected = () => {
  const cmds = flatFilteredCommands.value
  const selected = cmds.find(cmd => cmd.id === selectedCommandId.value) || cmds[0]
  if (selected) executeCommand(selected.id)
}

const executeCommand = (id: string) => {
  emit('execute', id)
  emit('update:modelValue', false)
}

const executeAI = async () => {
  if (!aiPrompt.value || aiProcessing.value) return
  aiProcessing.value = true
  emit('ai-execute', aiPrompt.value)
  // Don't close immediately - let the parent handle it
  setTimeout(() => {
    aiProcessing.value = false
    emit('update:modelValue', false)
  }, 500)
}

watch(() => props.modelValue, (val) => {
  if (val) {
    searchQuery.value = ''
    selectedCommandId.value = flatFilteredCommands.value[0]?.id || ''
    nextTick(() => {
      inputRef.value?.focus()
    })
  }
})

watch(selectedCommandId, async (id) => {
  if (!props.modelValue || !id) return

  await nextTick()
  document
    .getElementById(`command-${safeCommandId(id)}`)
    ?.scrollIntoView({ block: 'nearest' })
})

const inputRef = ref()

const safeCommandId = (id: string) =>
  Array.from(id).map(char => char.codePointAt(0)?.toString(16) || '0').join('-')
</script>

<style scoped>
.command-palette {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.command-palette :deep(.el-input__wrapper) {
  border-radius: var(--radius-md);
  transition: box-shadow 0.2s ease, border-color 0.2s ease;
}

.command-palette :deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px var(--obsidian-accent-soft);
}

.command-palette :deep(.el-input__wrapper:focus-within) {
  box-shadow: 0 0 0 2px var(--obsidian-accent);
}

.command-palette :deep(.el-input-group__append) {
  background: var(--obsidian-bg-tertiary);
  border: 1px solid var(--obsidian-border);
  border-left: none;
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
  padding: 0 8px;
}

.command-palette :deep(.el-input-group__append .el-button) {
  margin: 0;
  border: none;
  background: transparent;
  color: var(--obsidian-text-muted);
  transition: all 0.15s ease;
}

.command-palette :deep(.el-input-group__append .el-button:hover) {
  color: var(--obsidian-accent);
}

.command-palette :deep(.el-input-group__append .el-button--primary) {
  color: var(--obsidian-accent);
  background: var(--obsidian-accent-soft);
}

.command-list-scroll {
  margin: 0 -20px;
  padding: 0 20px;
}

.command-category {
  margin-bottom: 4px;
}

.category-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--obsidian-text-muted);
  letter-spacing: 0;
  text-transform: uppercase;
  line-height: 1.2;
  padding: 10px 12px 6px;
}

.command-item {
  width: 100%;
  height: 44px;
  min-height: 44px;
  box-sizing: border-box;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  cursor: pointer;
  transition: background 0.15s ease, transform 0.1s ease;
  text-align: left;
  font: inherit;
  touch-action: manipulation;
  position: relative;
}

.command-item:hover,
.command-item.active {
  background: var(--obsidian-bg-hover);
}

.command-item.active {
  background: var(--obsidian-accent-soft);
  box-shadow: inset 3px 0 0 var(--obsidian-accent);
}

.command-item:active {
  transform: scale(0.99);
}

.command-item:focus-visible {
  background: var(--obsidian-accent-soft);
  outline: 2px solid var(--obsidian-accent);
  outline-offset: -2px;
}

.command-item .el-icon {
  color: var(--obsidian-text-muted);
  flex-shrink: 0;
  font-size: 18px;
  transition: color 0.15s ease, transform 0.15s ease;
}

.command-item:hover .el-icon {
  color: var(--obsidian-text-normal);
  transform: scale(1.1);
}

.command-item.active .el-icon {
  color: var(--obsidian-accent);
}

.command-label-group {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.command-label {
  font-size: 14px;
  line-height: 1.35;
  color: var(--obsidian-text-normal);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 0.15s ease;
}

.command-item:hover .command-label {
  color: var(--obsidian-text-normal);
}

.command-item.active .command-label {
  color: var(--obsidian-accent);
}

.command-description {
  font-size: 12px;
  line-height: 1.35;
  color: var(--obsidian-text-faint);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 0.15s ease;
}

.command-shortcut {
  flex-shrink: 0;
  max-width: 38%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--obsidian-text-faint);
  background: var(--obsidian-bg-hover);
  padding: 2px 6px;
  border-radius: var(--radius-xs);
  font-family: var(--font-mono);
  border: 1px solid var(--obsidian-border);
  transition: background 0.15s ease, border-color 0.15s ease;
}

.command-item:hover .command-shortcut {
  background: var(--obsidian-bg-active);
  border-color: var(--obsidian-border);
}

.command-item.active .command-shortcut {
  background: var(--obsidian-accent-soft);
  border-color: var(--obsidian-accent);
  color: var(--obsidian-accent);
}

.command-empty {
  padding: 24px;
  text-align: center;
  color: var(--obsidian-text-faint);
  font-size: 13px;
}

/* AI Mode Section */
.ai-mode-section {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--obsidian-border);
  animation: ai-mode-in 0.2s var(--ease-spring) both;
}

@keyframes ai-mode-in {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.ai-mode-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  font-size: 11px;
  font-weight: 700;
  color: var(--obsidian-accent);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.ai-mode-header .el-icon {
  font-size: 14px;
}

.ai-mode-hint {
  margin-left: auto;
  font-size: 10px;
  color: var(--obsidian-text-faint);
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
}

.ai-mode-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: var(--obsidian-accent-soft);
  border: 1px solid var(--obsidian-accent);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.15s var(--ease-spring);
  color: var(--obsidian-text-normal);
  font: inherit;
  text-align: left;
}

.ai-mode-item:hover {
  background: var(--obsidian-accent);
  color: #fff;
}

.ai-mode-item:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.ai-mode-item .el-icon {
  color: var(--obsidian-accent);
  font-size: 18px;
  transition: color 0.15s ease;
}

.ai-mode-item:hover .el-icon {
  color: #fff;
}

.ai-mode-prompt {
  flex: 1;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-processing {
  font-size: 11px;
  color: var(--obsidian-text-faint);
  animation: pulse 1s ease-in-out infinite;
}

.ai-mode-examples {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  font-size: 11px;
  color: var(--obsidian-text-faint);
  flex-wrap: wrap;
}

.ai-example {
  padding: 2px 8px;
  background: var(--obsidian-bg-hover);
  border: 1px solid var(--obsidian-border);
  border-radius: var(--radius-full);
  color: var(--obsidian-text-muted);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.ai-example:hover {
  background: var(--obsidian-accent-soft);
  border-color: var(--obsidian-accent);
  color: var(--obsidian-accent);
}

@media (max-width: 480px) {
  .command-list-scroll {
    margin: 0 -8px;
    padding: 0 8px;
  }

  .command-shortcut {
    display: none;
  }
}
</style>

<style>
.command-palette-dialog .el-dialog__header {
  display: none;
}

.command-palette-dialog .el-dialog__body {
  padding: 16px 20px;
}

.command-palette-dialog.el-dialog {
  max-width: calc(100vw - 32px);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg), 0 0 0 1px rgba(124, 109, 242, 0.1);
  overflow: hidden;
  backdrop-filter: blur(20px);
  background: var(--obsidian-bg-secondary);
  border: 1px solid var(--obsidian-border);
}

/* Entry animation */
.command-palette-dialog.el-dialog {
  animation: palette-in 0.2s var(--ease-spring) both;
}

@keyframes palette-in {
  from {
    opacity: 0;
    transform: translateY(-12px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>
