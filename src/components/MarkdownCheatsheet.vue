<template>
  <el-dialog
    v-model="visible"
    title="Markdown 语法参考"
    width="560px"
    :close-on-click-modal="true"
    destroy-on-close
  >
    <div class="cheatsheet">
      <div v-for="section in sections" :key="section.title" class="cheatsheet-section">
        <h4 class="section-title">{{ section.title }}</h4>
        <div v-for="item in section.items" :key="item.syntax" class="cheatsheet-item">
          <code class="syntax">{{ item.syntax }}</code>
          <span class="description">{{ item.description }}</span>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  modelValue: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (val: boolean) => emit('update:modelValue', val)
})

const sections = [
  {
    title: '标题',
    items: [
      { syntax: '# 标题', description: '一级标题' },
      { syntax: '## 标题', description: '二级标题' },
      { syntax: '### 标题', description: '三级标题' },
    ]
  },
  {
    title: '文本样式',
    items: [
      { syntax: '**粗体**', description: '粗体文本' },
      { syntax: '*斜体*', description: '斜体文本' },
      { syntax: '~~删除线~~', description: '删除线文本' },
      { syntax: '`行内代码`', description: '行内代码' },
    ]
  },
  {
    title: '列表',
    items: [
      { syntax: '- 项目', description: '无序列表' },
      { syntax: '1. 项目', description: '有序列表' },
      { syntax: '- [ ] 任务', description: '任务列表' },
    ]
  },
  {
    title: '链接与图片',
    items: [
      { syntax: '[文字](url)', description: '链接' },
      { syntax: '![描述](url)', description: '图片' },
    ]
  },
  {
    title: '代码块',
    items: [
      { syntax: '```语言\\n代码\\n```', description: '代码块' },
    ]
  },
  {
    title: '引用与分割线',
    items: [
      { syntax: '> 引用', description: '引用块' },
      { syntax: '---', description: '分割线' },
    ]
  },
  {
    title: '表格',
    items: [
      { syntax: '| 列1 | 列2 |\\n|---|---|\\n| 内容 | 内容 |', description: '表格' },
    ]
  },
]
</script>

<style scoped>
.cheatsheet {
  max-height: 60vh;
  overflow-y: auto;
}

.cheatsheet-section {
  margin-bottom: 20px;
}

.section-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--obsidian-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--obsidian-border);
}

.cheatsheet-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0;
  gap: 12px;
}

.syntax {
  background: var(--obsidian-bg-tertiary);
  padding: 2px 8px;
  border-radius: var(--radius-xs);
  font-size: 13px;
  font-family: var(--font-mono, monospace);
  white-space: pre;
  color: var(--obsidian-accent);
}

.description {
  font-size: 13px;
  color: var(--obsidian-text-muted);
  flex-shrink: 0;
}
</style>
