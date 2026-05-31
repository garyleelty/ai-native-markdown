<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    :show-close="false"
    width="480px"
    top="15vh"
    class="command-palette-dialog"
    :append-to-body="true"
    destroy-on-close
  >
    <div class="command-palette">
      <el-input
        ref="inputRef"
        v-model="searchQuery"
        placeholder="输入命令..."
        size="large"
        clearable
        @keydown.down.prevent="navigateDown"
        @keydown.up.prevent="navigateUp"
        @keydown.enter.prevent="executeSelected"
        @keydown.escape="$emit('update:modelValue', false)"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>

      <el-scrollbar max-height="360px" class="command-list-scroll">
        <div v-for="category in filteredCategories" :key="category.label" class="command-category">
          <div class="category-label">{{ category.label }}</div>
          <div
            v-for="cmd in category.commands"
            :key="cmd.id"
            class="command-item"
            :class="{ active: cmd.id === selectedCommandId }"
            @click="executeCommand(cmd.id)"
            @mouseenter="selectedCommandId = cmd.id"
          >
            <el-icon><component :is="cmd.icon" /></el-icon>
            <span class="command-label">{{ cmd.label }}</span>
            <span v-if="cmd.shortcut" class="command-shortcut">{{ cmd.shortcut }}</span>
          </div>
        </div>
        <div v-if="flatFilteredCommands.length === 0" class="command-empty">
          未找到匹配的命令
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
  Delete, Connection, Grid, Monitor, Clock, FullScreen, Notebook
} from '@element-plus/icons-vue'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'execute', command: string): void
}>()

interface Command {
  id: string
  label: string
  icon: any
  shortcut?: string
  category: string
}

const commands: Command[] = [
  { id: 'file.new', label: '新建文件', icon: DocumentAdd, shortcut: 'Ctrl+N', category: '文件' },
  { id: 'file.new-folder', label: '新建文件夹', icon: FolderAdd, category: '文件' },
  { id: 'file.open', label: '打开文件夹', icon: FolderOpened, category: '文件' },
  { id: 'file.save', label: '保存', icon: Check, shortcut: 'Ctrl+S', category: '文件' },
  { id: 'file.version-history', label: '版本历史', icon: Clock, shortcut: 'Ctrl+Shift+H', category: '文件' },
  { id: 'file.new-from-template', label: '从模板新建', icon: Grid, category: '文件' },
  { id: 'file.export-md', label: '导出 Markdown', icon: Download, category: '文件' },
  { id: 'file.export-html', label: '导出 HTML', icon: Download, category: '文件' },
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
  { id: 'view.source', label: '源码模式', icon: EditPen, category: '视图' },
  { id: 'view.split', label: '分屏模式', icon: Grid, category: '视图' },
  { id: 'view.preview', label: '预览模式', icon: View, category: '视图' },
  { id: 'view.theme', label: '切换主题', icon: Sunny, category: '视图' },
  { id: 'view.focus-mode', label: '专注模式', icon: FullScreen, shortcut: 'F11', category: '视图' },
  { id: 'view.cheatsheet', label: 'Markdown 速查表', icon: Notebook, category: '视图' },
  { id: 'ai.clear', label: '清空对话', icon: Delete, category: 'AI' },
  { id: 'ai.test', label: '测试连接', icon: Connection, category: 'AI' },
]

const categoryOrder = [
  { label: '文件', key: '文件' },
  { label: '编辑', key: '编辑' },
  { label: '视图', key: '视图' },
  { label: 'AI', key: 'AI' },
]

const searchQuery = ref('')
const selectedCommandId = ref('')

const filteredCategories = computed(() => {
  const q = searchQuery.value.toLowerCase()
  return categoryOrder
    .map(cat => ({
      ...cat,
      commands: commands.filter(
        cmd => cmd.category === cat.key && (q === '' || cmd.label.toLowerCase().includes(q) || cmd.id.includes(q))
      )
    }))
    .filter(cat => cat.commands.length > 0)
})

const flatFilteredCommands = computed(() =>
  filteredCategories.value.flatMap(cat => cat.commands)
)

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
  if (selectedCommandId.value) {
    executeCommand(selectedCommandId.value)
  }
}

const executeCommand = (id: string) => {
  emit('execute', id)
  emit('update:modelValue', false)
}

watch(() => props.modelValue, (val) => {
  if (val) {
    searchQuery.value = ''
    nextTick(() => {
      inputRef.value?.focus()
    })
  }
})

const inputRef = ref()
</script>

<style scoped>
.command-palette {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.command-palette :deep(.el-input__wrapper) {
  border-radius: var(--radius-md);
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
  letter-spacing: 0.5px;
  text-transform: uppercase;
  padding: 8px 12px 4px;
}

.command-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 0.15s ease;
}

.command-item:hover,
.command-item.active {
  background: var(--obsidian-bg-hover);
}

.command-item.active {
  background: var(--obsidian-accent-soft);
}

.command-item .el-icon {
  color: var(--obsidian-text-muted);
  flex-shrink: 0;
}

.command-item.active .el-icon {
  color: var(--obsidian-accent);
}

.command-label {
  flex: 1;
  font-size: 13px;
  color: var(--obsidian-text-normal);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.command-shortcut {
  font-size: 11px;
  color: var(--obsidian-text-faint);
  background: var(--obsidian-bg-tertiary);
  padding: 2px 6px;
  border-radius: var(--radius-xs);
  font-family: var(--font-sans);
}

.command-empty {
  padding: 24px;
  text-align: center;
  color: var(--obsidian-text-faint);
  font-size: 13px;
}
</style>

<style>
.command-palette-dialog .el-dialog__header {
  display: none;
}

.command-palette-dialog .el-dialog__body {
  padding: 16px 20px;
}

.command-palette-dialog .el-dialog {
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
}
</style>
