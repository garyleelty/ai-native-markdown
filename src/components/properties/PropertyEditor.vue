<template>
  <div class="property-editor">
    <div class="property-header">
      <span class="property-key">{{ keyName }}</span>
      <el-dropdown @command="handleTypeChange" trigger="click">
        <el-button size="small" link class="type-button">
          {{ typeLabel }}
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item v-for="t in ALL_TYPES" :key="t" :command="t" :class="{ active: type === t }">
              {{ getTypeLabel(t) }}
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      <el-button size="small" link type="danger" @click="handleDelete" class="delete-button">
        ✕
      </el-button>
    </div>
    <div class="property-value">
      <input
        v-if="type === 'text'"
        type="text"
        :value="stringValue"
        @input="handleTextUpdate"
        class="property-input"
        placeholder="输入文本"
      />
      <input
        v-else-if="type === 'number'"
        type="number"
        :value="numberValue"
        @input="handleNumberUpdate"
        class="property-input"
        placeholder="输入数字"
      />
      <el-checkbox
        v-else-if="type === 'boolean'"
        :model-value="booleanValue"
        @change="handleBooleanUpdate"
      />
      <el-date-picker
        v-else-if="type === 'date'"
        v-model="dateValue"
        type="date"
        format="YYYY-MM-DD"
        value-format="YYYY-MM-DD"
        @change="handleDateUpdate"
        class="property-input"
        placeholder="选择日期"
      />
      <el-input
        v-else-if="type === 'tag'"
        type="textarea"
        :model-value="tagsValue"
        @input="handleTagsUpdate"
        class="property-input"
        placeholder="输入标签（逗号分隔）"
        :rows="1"
      />
      <input
        v-else-if="type === 'url'"
        type="url"
        :value="stringValue"
        @input="handleTextUpdate"
        class="property-input"
        placeholder="https://example.com"
      />
      <input
        v-else-if="type === 'email'"
        type="email"
        :value="stringValue"
        @input="handleTextUpdate"
        class="property-input"
        placeholder="user@example.com"
      />
      <el-select
        v-else-if="type === 'select'"
        v-model="selectValue"
        @change="handleSelectUpdate"
        class="property-input"
        placeholder="选择选项"
        allow-create
        filterable
      >
        <el-option v-for="opt in selectOptions" :key="opt" :label="opt" :value="opt" />
      </el-select>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PropertyType } from '@/types/properties'

const ALL_TYPES: PropertyType[] = ['text', 'number', 'boolean', 'date', 'tag', 'select', 'url', 'email']

const props = defineProps<{
  keyName: string
  value: any
  type: PropertyType
}>()

const emit = defineEmits<{
  update: [key: string, value: any]
  changeType: [key: string, type: PropertyType]
  delete: [key: string]
}>()

function getTypeLabel(t: PropertyType): string {
  const labels: Record<PropertyType, string> = {
    text: '文本',
    number: '数字',
    boolean: '开关',
    date: '日期',
    tag: '标签',
    select: '选择',
    url: '链接',
    email: '邮箱',
  }
  return labels[t]
}

const typeLabel = computed(() => getTypeLabel(props.type))

const stringValue = computed(() => {
  if (typeof props.value === 'string') return props.value
  if (typeof props.value === 'number' || typeof props.value === 'boolean') return String(props.value)
  if (Array.isArray(props.value)) return props.value.join(', ')
  return ''
})

const numberValue = computed(() => {
  if (typeof props.value === 'number') return props.value
  if (typeof props.value === 'string') {
    const n = Number(props.value)
    if (!isNaN(n)) return n
  }
  return ''
})

const booleanValue = computed(() => {
  if (typeof props.value === 'boolean') return props.value
  if (props.value === 'true') return true
  if (props.value === 'false') return false
  return false
})

const dateValue = computed(() => {
  if (typeof props.value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(props.value)) return props.value
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(props.value)) return props.value.slice(0, 10)
  }
  return ''
})

const tagsValue = computed(() => {
  if (Array.isArray(props.value)) return props.value.join(', ')
  if (typeof props.value === 'string') return props.value
  return ''
})

const selectOptions = ['待办', '进行中', '已完成', '已取消']

const selectValue = computed({
  get: () => {
    if (typeof props.value === 'string') return props.value
    return ''
  },
  set: (val: string) => {
    emit('update', props.keyName, val)
  }
})

function handleSelectUpdate(value: string) {
  emit('update', props.keyName, value)
}

function handleTextUpdate(e: Event) {
  const target = e.target as HTMLInputElement
  emit('update', props.keyName, target.value)
}

function handleNumberUpdate(e: Event) {
  const target = e.target as HTMLInputElement
  const value = target.value
  if (value === '') {
    emit('update', props.keyName, '')
  } else {
    const n = Number(value)
    if (!isNaN(n)) emit('update', props.keyName, n)
  }
}

function handleBooleanUpdate(checked: boolean) {
  emit('update', props.keyName, checked)
}

function handleDateUpdate(date: string | null) {
  emit('update', props.keyName, date || '')
}

function handleTagsUpdate(value: string) {
  const tags = value.split(',').map(tag => tag.trim()).filter(tag => tag.startsWith('#') || tag).map(tag => {
    if (!tag.startsWith('#') && tag) return '#' + tag
    return tag
  }).filter(Boolean)
  emit('update', props.keyName, tags)
}

function handleTypeChange(newType: PropertyType) {
  emit('changeType', props.keyName, newType)
}

function handleDelete() {
  emit('delete', props.keyName)
}
</script>

<style scoped>
.property-editor {
  padding: 10px 8px;
  border-radius: 6px;
  margin-bottom: 6px;
  transition: all 0.15s ease;
}

.property-editor:hover {
  background: var(--obsidian-bg-secondary);
}

.property-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}

.property-key {
  font-weight: 500;
  color: var(--obsidian-text-normal);
  font-size: 13px;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.type-button {
  padding: 2px 6px !important;
  font-size: 11px;
  color: var(--obsidian-text-faint);
  border-radius: 4px;
  transition: all 0.15s ease;
}

.type-button:hover {
  background: var(--obsidian-bg-tertiary);
  color: var(--obsidian-text-muted);
}

.delete-button {
  padding: 2px 6px !important;
  margin-left: auto;
  color: var(--obsidian-text-faint);
  border-radius: 4px;
  transition: all 0.15s ease;
}

.delete-button:hover {
  color: var(--obsidian-error);
  background: var(--obsidian-error-bg);
}

.property-value {
  width: 100%;
}

.property-input {
  width: 100%;
  padding: 7px 10px;
  border: 1px solid var(--obsidian-border);
  background: var(--obsidian-bg-primary);
  color: var(--obsidian-text-normal);
  border-radius: 4px;
  font-size: 13px;
  transition: all 0.15s ease;
}

.property-input:focus {
  outline: none;
  border-color: var(--obsidian-accent);
  box-shadow: 0 0 0 3px var(--obsidian-accent-dim);
}

.property-input::placeholder {
  color: var(--obsidian-text-faint);
}

.is-active {
  color: var(--obsidian-accent);
  font-weight: 500;
}

:deep(.el-checkbox) {
  margin: 0;
}

:deep(.el-checkbox__label) {
  color: var(--obsidian-text-normal);
  font-size: 13px;
}

:deep(.el-date-picker) {
  width: 100%;
}

:deep(.el-input__wrapper) {
  background: var(--obsidian-bg-primary);
  border-color: var(--obsidian-border);
}

:deep(.el-input__wrapper:hover) {
  border-color: var(--obsidian-border-hover);
}

:deep(.el-input__wrapper.is-focus) {
  border-color: var(--obsidian-accent);
  box-shadow: 0 0 0 3px var(--obsidian-accent-dim);
}

:deep(.el-textarea__inner) {
  background: var(--obsidian-bg-primary);
  border-color: var(--obsidian-border);
  color: var(--obsidian-text-normal);
}

:deep(.el-textarea__inner:focus) {
  border-color: var(--obsidian-accent);
  box-shadow: 0 0 0 3px var(--obsidian-accent-dim);
}

:deep(.el-dropdown-menu__item) {
  color: var(--obsidian-text-normal);
}

:deep(.el-dropdown-menu__item:hover) {
  background: var(--obsidian-bg-hover);
}

:deep(.el-dropdown-menu__item.active) {
  background: var(--obsidian-accent-dim);
  color: var(--obsidian-accent);
}
</style>
