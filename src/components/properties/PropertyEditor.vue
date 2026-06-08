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
      <input
        v-else-if="type === 'select'"
        type="text"
        :value="stringValue"
        @input="handleTextUpdate"
        class="property-input"
        placeholder="输入选项"
      />
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
  if (date) {
    emit('update', props.keyName, date)
  }
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
  padding: 8px 0;
  border-bottom: 1px solid var(--obsidian-border);
}

.property-editor:last-child {
  border-bottom: none;
}

.property-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.property-key {
  font-weight: 500;
  color: var(--obsidian-text-normal);
  font-size: 13px;
}

.type-button {
  padding: 2px 6px !important;
  font-size: 11px;
  color: var(--obsidian-text-faint);
}

.delete-button {
  padding: 2px 4px !important;
  margin-left: auto;
  color: var(--obsidian-text-faint);
}

.delete-button:hover {
  color: var(--obsidian-error);
}

.property-value {
  width: 100%;
}

.property-input {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid var(--obsidian-border);
  background: var(--obsidian-bg-primary);
  color: var(--obsidian-text-normal);
  border-radius: 4px;
  font-size: 13px;
}

.property-input:focus {
  outline: none;
  border-color: var(--obsidian-accent);
}

.is-active {
  color: var(--obsidian-accent);
  font-weight: 500;
}
</style>
