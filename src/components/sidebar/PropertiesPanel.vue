<template>
  <div class="properties-panel">
    <div class="panel-header">
      <h3>📋 属性</h3>
      <el-button size="small" link @click="showAddProperty = !showAddProperty">
        {{ showAddProperty ? '取消' : '+ 添加' }}
      </el-button>
    </div>

    <div v-if="showAddProperty" class="add-property-form">
      <el-input v-model="newPropertyKey" placeholder="属性名" size="small" class="property-key-input" />
      <el-input v-model="newPropertyValue" placeholder="属性值" size="small" class="property-value-input" />
      <el-button size="small" @click="handleAddProperty" type="primary">添加</el-button>
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
import { ref, watch } from 'vue'
import PropertyEditor from '@/components/properties/PropertyEditor.vue'
import { useProperties } from '@/composables/useProperties'

const props = defineProps<{
  content: string
  filePath: string
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
  filePath: props.filePath
})

const newPropertyKey = ref('')
const newPropertyValue = ref('')

function handleAddProperty() {
  if (newPropertyKey.value.trim()) {
    addProperty(newPropertyKey.value.trim(), newPropertyValue.value.trim())
    newPropertyKey.value = ''
    newPropertyValue.value = ''
    showAddProperty.value = false
  }
}

watch(() => props.content, () => {
  load()
}, { immediate: true })
</script>

<style scoped>
.properties-panel {
  padding: 12px;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.panel-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--obsidian-text-normal);
}

.add-property-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: var(--obsidian-bg-secondary);
  border-radius: 6px;
  margin-bottom: 12px;
}

.property-key-input,
.property-value-input {
  width: 100%;
}

.panel-loading,
.panel-empty {
  padding: 24px 12px;
  text-align: center;
  color: var(--obsidian-text-faint);
  font-size: 13px;
}

.property-list {
  max-height: 400px;
  overflow-y: auto;
}
</style>
