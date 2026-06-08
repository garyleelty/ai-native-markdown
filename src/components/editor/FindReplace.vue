<template>
  <div class="find-replace-panel" v-if="visible">
    <div class="find-row">
      <el-input
        ref="findInputRef"
        v-model="findText"
        placeholder="查找..."
        size="small"
        clearable
        @keydown.enter.prevent="findNext"
        @keydown.esc="close"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
      <el-button size="small" :icon="Top" native-type="button" circle aria-label="上一个匹配" @click="findPrev" :disabled="!findText" title="上一个" />
      <el-button size="small" :icon="Bottom" native-type="button" circle aria-label="下一个匹配" @click="findNext" :disabled="!findText" title="下一个" />
      <el-tag size="small" type="info" v-if="matchCount >= 0">{{ currentMatch }}/{{ matchCount }}</el-tag>
      <el-button size="small" :icon="Close" native-type="button" circle aria-label="关闭查找替换" @click="close" title="关闭" />
    </div>
    <div class="replace-row" v-if="showReplace">
      <el-input
        v-model="replaceText"
        placeholder="替换为..."
        size="small"
        clearable
        @keydown.enter.prevent="replaceNext"
      />
      <el-button size="small" native-type="button" @click="replaceNext" :disabled="!findText">替换</el-button>
      <el-button size="small" native-type="button" @click="replaceAll" :disabled="!findText">全部替换</el-button>
    </div>
    <div class="options-row">
      <el-checkbox v-model="caseSensitive" size="small">区分大小写</el-checkbox>
      <el-checkbox v-model="useRegex" size="small">正则表达式</el-checkbox>
      <el-button size="small" text native-type="button" @click="showReplace = !showReplace">
        {{ showReplace ? '隐藏替换' : '替换' }}
      </el-button>
    </div>
    <div v-if="searchError" class="search-error" role="alert">{{ searchError }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { Search, Top, Bottom, Close } from '@element-plus/icons-vue'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'find', text: string, options: { caseSensitive: boolean; useRegex: boolean; direction: 'next' | 'prev' }): void
  (e: 'replace', findText: string, replaceText: string, options: { caseSensitive: boolean; useRegex: boolean }): void
  (e: 'replace-all', findText: string, replaceText: string, options: { caseSensitive: boolean; useRegex: boolean }): void
  (e: 'close'): void
}>()

const findText = ref('')
const replaceText = ref('')
const caseSensitive = ref(false)
const useRegex = ref(false)
const showReplace = ref(false)
const matchCount = ref(-1)
const currentMatch = ref(0)
const searchError = ref('')
const findInputRef = ref()

watch(() => props.visible, (val) => {
  if (val) {
    nextTick(() => findInputRef.value?.focus())
  }
})

watch([findText, replaceText, useRegex, caseSensitive], () => {
  searchError.value = ''
})

const findNext = () => {
  if (!findText.value) return
  emit('find', findText.value, { caseSensitive: caseSensitive.value, useRegex: useRegex.value, direction: 'next' })
}

const findPrev = () => {
  if (!findText.value) return
  emit('find', findText.value, { caseSensitive: caseSensitive.value, useRegex: useRegex.value, direction: 'prev' })
}

const replaceNext = () => {
  emit('replace', findText.value, replaceText.value, { caseSensitive: caseSensitive.value, useRegex: useRegex.value })
}

const replaceAll = () => {
  emit('replace-all', findText.value, replaceText.value, { caseSensitive: caseSensitive.value, useRegex: useRegex.value })
}

const close = () => {
  emit('update:visible', false)
  emit('close')
}

const setMatchInfo = (current: number, total: number) => {
  searchError.value = ''
  currentMatch.value = current
  matchCount.value = total
}

const setSearchError = (message: string) => {
  searchError.value = message
  currentMatch.value = 0
  matchCount.value = 0
}

const openReplace = () => {
  showReplace.value = true
}

defineExpose({ setMatchInfo, setSearchError, findText, openReplace })
</script>

<style scoped>
.find-replace-panel {
  padding: 8px 12px;
  background: var(--obsidian-bg-secondary);
  border-bottom: 1px solid var(--obsidian-border);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.find-row, .replace-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.find-row .el-input, .replace-row .el-input {
  flex: 1;
}

.options-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-left: 4px;
}

.search-error {
  font-size: 12px;
  color: var(--accent-red);
  padding-left: 4px;
}
</style>
