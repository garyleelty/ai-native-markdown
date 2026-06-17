<template>
  <el-dialog v-model="visible" title="从模板创建" width="600px" class="responsive-dialog" @close="$emit('update:modelValue', false)">
    <div class="template-toolbar">
      <el-input v-model="searchQuery" placeholder="搜索模板..." aria-label="搜索模板" clearable :prefix-icon="Search" />
      <el-button :icon="Plus" native-type="button" aria-label="保存当前文档为模板" @click="openSaveDialog">保存为模板</el-button>
    </div>
    <div class="template-grid">
      <el-card
        v-for="t in filteredTemplates"
        :key="t.id"
        shadow="hover"
        class="template-card"
        role="button"
        tabindex="0"
        :aria-label="`使用${t.name}模板`"
        @click="selectTemplate(t)"
        @keydown.enter.prevent="selectTemplate(t)"
        @keydown.space.prevent="selectTemplate(t)"
      >
        <div class="template-icon">
          <el-icon :size="24"><component :is="t.icon" /></el-icon>
        </div>
        <div class="template-name">{{ t.name }}</div>
        <button
          v-if="!t.builtIn"
          type="button"
          class="template-delete"
          aria-label="删除模板"
          @click.stop="deleteTemplate(t)"
        >
          <el-icon :size="12"><Delete /></el-icon>
        </button>
      </el-card>
    </div>

    <el-dialog v-model="showSaveDialog" title="保存为模板" width="400px" append-to-body>
      <el-form label-position="top">
        <el-form-item label="模板名称">
          <el-input v-model="saveName" placeholder="我的模板" aria-label="模板名称" />
        </el-form-item>
        <el-form-item label="模板内容">
          <el-input v-model="saveContent" type="textarea" :rows="8" aria-label="模板内容" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button native-type="button" @click="showSaveDialog = false">取消</el-button>
        <el-button type="primary" native-type="button" @click="handleSaveTemplate">保存</el-button>
      </template>
    </el-dialog>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, type Component } from 'vue'
import { Search, Document, Notebook, TrendCharts, ChatDotRound, Memo, Calendar, Reading, Trophy, Plus, Delete } from '@element-plus/icons-vue'
import { templateService, type TemplateEntry } from '@/services/templateService'
import { ElMessage, ElMessageBox } from 'element-plus'

const props = defineProps<{
  modelValue: boolean
  currentContent?: string
}>()
const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
  (e: 'select', content: string, name: string): void
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

const searchQuery = ref('')
const showSaveDialog = ref(false)
const saveName = ref('')
const saveContent = ref('')
const refreshKey = ref(0)

const iconMap: Record<string, Component> = {
  blank: Document, blog: Notebook, readme: Memo, meeting: Calendar,
  weekly: TrendCharts, api: Reading, tutorial: Trophy, 'chat-export': ChatDotRound,
}

const templates = computed(() => {
  void refreshKey.value
  return templateService.getAllTemplates().map(t => ({
    ...t,
    icon: t.builtIn ? (iconMap[t.id] || Document) : Document,
  }))
})

const filteredTemplates = computed(() => {
  if (!searchQuery.value) return templates.value
  const q = searchQuery.value.toLowerCase()
  return templates.value.filter(t => t.name.toLowerCase().includes(q))
})

const selectTemplate = (t: TemplateEntry & { icon: Component }) => {
  const content = t.content
    .replace('{{date}}', new Date().toLocaleDateString('zh-CN'))
    .replace('{{week}}', `W${Math.ceil((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 604800000)}`)
  emit('select', content, `${t.name}.md`)
  visible.value = false
}

const openSaveDialog = () => {
  saveName.value = ''
  saveContent.value = props.currentContent || ''
  showSaveDialog.value = true
}

const handleSaveTemplate = () => {
  if (!saveName.value.trim()) {
    ElMessage.warning('请输入模板名称')
    return
  }
  try {
    templateService.saveUserTemplate({ name: saveName.value.trim(), content: saveContent.value })
    showSaveDialog.value = false
    refreshKey.value++
    ElMessage.success('模板已保存')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存失败')
  }
}

const deleteTemplate = async (t: TemplateEntry) => {
  if (t.builtIn) return
  try {
    await ElMessageBox.confirm(`确定删除模板「${t.name}」？`, '删除模板', { type: 'warning' })
    templateService.deleteUserTemplate(t.id)
    refreshKey.value++
    ElMessage.success('已删除')
  } catch {
    // cancelled
  }
}
</script>

<style scoped>
.template-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(132px, 1fr));
  gap: 12px;
}

.template-card {
  position: relative;
  cursor: pointer;
  text-align: center;
  transition: all 0.2s;
}

.template-card:hover {
  border-color: var(--obsidian-accent);
}

.template-card:focus-visible {
  outline: 2px solid var(--obsidian-accent);
  outline-offset: 2px;
  border-color: var(--obsidian-accent);
}

.template-card :deep(.el-card__body) {
  min-height: 112px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.template-icon {
  margin-bottom: 8px;
  color: var(--obsidian-accent);
}

.template-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--obsidian-text-normal);
  margin-bottom: 4px;
}

.template-delete {
  position: absolute;
  top: 4px;
  right: 4px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--obsidian-text-faint);
  padding: 2px;
  border-radius: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.template-card:hover .template-delete {
  opacity: 1;
}

.template-delete:hover {
  color: var(--el-color-danger);
  background: var(--obsidian-bg-hover);
}
</style>
