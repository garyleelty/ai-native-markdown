<template>
  <div class="properties-panel">
    <div class="panel-header" :class="{ compact: embedded }">
      <h3 v-if="!embedded">
        <el-icon><Tickets /></el-icon>
        属性
      </h3>
      <span v-else class="panel-kicker">Frontmatter</span>
      <el-button size="small" link @click="handleShowAddProperty">
        {{ showAddProperty ? '取消' : '+ 添加' }}
      </el-button>
    </div>

    <div v-if="showAddProperty" class="add-property-form">
      <el-input v-model="newPropertyKey" ref="keyInputRef" placeholder="属性名" size="small" class="property-key-input" />
      <el-input v-model="newPropertyValue" ref="valueInputRef" placeholder="属性值" size="small" class="property-value-input" />
      <el-button size="small" @click="handleAddProperty" type="primary">添加</el-button>
      <div class="form-hint">
        <span class="hint-item">Ctrl/⌘+Enter 添加</span>
        <span class="hint-item">Tab 切换</span>
        <span class="hint-item">Esc 取消</span>
      </div>
    </div>

    <div v-if="loading" class="panel-loading">加载中...</div>

    <div v-else-if="Object.keys(frontmatter).length === 0" class="panel-empty">
      暂无属性，点击上方按钮添加
    </div>

    <div v-else class="property-list">
      <PropertyEditor
        v-for="(value, key) in frontmatter"
        :key="key"
        :key-name="key"
        :value="value"
        :type="(propertyTypes[key] || 'text') as any"
        @update="updateProperty"
        @change-type="setPropertyType"
        @delete="deleteProperty"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { Tickets } from '@element-plus/icons-vue'
import PropertyEditor from '@/components/properties/PropertyEditor.vue'
import { useProperties } from '@/composables/useProperties'

const props = defineProps<{
  content: string
  filePath: string
  embedded?: boolean
}>()

const emit = defineEmits<{
  contentChange: [content: string]
}>()

const {
  frontmatter,
  propertyTypes,
  loading,
  showAddProperty,
  load,
  updateProperty,
  deleteProperty,
  setPropertyType,
  addProperty,
} = useProperties({
  getContent: () => props.content,
  onContentChange: (newContent: string) => emit('contentChange', newContent),
  getFilePath: () => props.filePath
})

const newPropertyKey = ref('')
const newPropertyValue = ref('')
const keyInputRef = ref<any>(null)
const valueInputRef = ref<any>(null)

function getInputElement(inputRef: any): HTMLInputElement | HTMLTextAreaElement | null {
  return inputRef?.input || inputRef?.textarea || inputRef?.$el?.querySelector?.('input, textarea') || null
}

function focusInput(inputRef: any) {
  inputRef?.focus?.()
  getInputElement(inputRef)?.focus()
}

function handleAddProperty() {
  if (newPropertyKey.value.trim()) {
    addProperty(newPropertyKey.value.trim(), newPropertyValue.value.trim())
    newPropertyKey.value = ''
    newPropertyValue.value = ''
    showAddProperty.value = false
  }
}

function handleShowAddProperty() {
  showAddProperty.value = !showAddProperty.value
  if (showAddProperty.value) {
    setTimeout(() => {
      focusInput(keyInputRef.value)
    }, 100)
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (!showAddProperty.value) return

  if (e.key === 'Escape') {
    showAddProperty.value = false
    newPropertyKey.value = ''
    newPropertyValue.value = ''
  } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    handleAddProperty()
  } else if (e.key === 'Tab') {
    e.preventDefault()
    const active = document.activeElement
    if (active === getInputElement(keyInputRef.value)) {
      focusInput(valueInputRef.value)
    } else if (active === getInputElement(valueInputRef.value)) {
      focusInput(keyInputRef.value)
    }
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})

watch(() => [props.content, props.filePath] as const, () => {
  load()
}, { immediate: true })
</script>

<style scoped>
.properties-panel {
  padding: 12px;
  min-height: 200px;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--obsidian-border);
}

.panel-header.compact {
  margin-bottom: 8px;
  padding-bottom: 6px;
}

.panel-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--obsidian-text-normal);
  display: flex;
  align-items: center;
  gap: 6px;
}

.panel-kicker {
  color: var(--obsidian-text-faint);
  font-size: 10px;
  font-weight: 650;
  line-height: 1.4;
  text-transform: uppercase;
}

.add-property-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: var(--obsidian-bg-secondary);
  border-radius: 8px;
  margin-bottom: 12px;
  border: 1px solid var(--obsidian-border);
  animation: slideIn 0.2s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.property-key-input,
.property-value-input {
  width: 100%;
}

.panel-loading,
.panel-empty {
  padding: 32px 12px;
  text-align: center;
  color: var(--obsidian-text-faint);
  font-size: 13px;
}

.property-list {
  max-height: 400px;
  overflow-y: auto;
  padding-right: 4px;
}

.property-list::-webkit-scrollbar {
  width: 6px;
}

.property-list::-webkit-scrollbar-track {
  background: transparent;
}

.property-list::-webkit-scrollbar-thumb {
  background: var(--obsidian-border);
  border-radius: 3px;
}

.property-list::-webkit-scrollbar-thumb:hover {
  background: var(--obsidian-text-faint);
}

.empty-icon {
  display: block;
  font-size: 24px;
  margin-bottom: 8px;
  opacity: 0.5;
}

.form-hint {
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: var(--obsidian-text-faint);
  padding-top: 4px;
}

.hint-item {
  padding: 2px 6px;
  background: var(--obsidian-bg-tertiary);
  border-radius: 4px;
}
</style>
