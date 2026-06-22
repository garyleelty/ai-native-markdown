<template>
  <el-dialog v-model="visible" title="导出文档" width="480px" class="responsive-dialog" @close="$emit('update:modelValue', false)">
    <el-form label-position="top">
      <el-form-item label="导出格式">
        <el-radio-group v-model="format" class="export-format-group">
          <el-radio-button value="markdown">Markdown</el-radio-button>
          <el-radio-button value="html">HTML</el-radio-button>
          <el-radio-button value="plain">纯文本</el-radio-button>
        </el-radio-group>
      </el-form-item>

      <template v-if="format === 'html'">
        <el-form-item label="包含样式">
          <el-switch v-model="includeStyles" />
        </el-form-item>
        <el-form-item label="包含目录">
          <el-switch v-model="includeTOC" />
        </el-form-item>
      </template>

      <el-form-item label="文件名">
        <el-input v-model="fileName" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button native-type="button" @click="visible = false">取消</el-button>
      <el-button type="primary" native-type="button" @click="handleExport">导出</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { createExportHtmlWithEmbeds } from '@/utils/exportHtml'

const props = defineProps<{
  modelValue: boolean
  content: string
  defaultFileName?: string
  currentFile?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

const format = ref<'markdown' | 'html' | 'plain'>('markdown')
const includeStyles = ref(true)
const includeTOC = ref(false)

const normalizeBaseName = (name: string): string => {
  const base = name
    .replace(/\.(md|markdown|html|txt)$/i, '')
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, '-')
    .trim()
  return base || 'document'
}

const fileName = ref(normalizeBaseName(props.defaultFileName || 'document'))

watch(() => props.defaultFileName, (newName) => {
  if (newName) fileName.value = normalizeBaseName(newName)
})

const getExtension = () => format.value === 'markdown' ? '.md' : format.value === 'html' ? '.html' : '.txt'

const convertToPlain = (content: string): string => {
  return content
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/!\[.*?\]\(.+?\)/g, '[图片]')
}

const handleExport = async () => {
  const baseName = normalizeBaseName(fileName.value)
  const ext = getExtension()

  try {
    let blob: Blob

    if (format.value === 'html') {
      const html = await createExportHtmlWithEmbeds(props.content, {
        title: baseName,
        includeStyles: includeStyles.value,
        includeTOC: includeTOC.value,
        currentFile: props.currentFile,
      })
      blob = new Blob([html], { type: 'text/html' })
    } else if (format.value === 'plain') {
      blob = new Blob([convertToPlain(props.content)], { type: 'text/plain' })
    } else {
      blob = new Blob([props.content], { type: 'text/markdown' })
    }

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${baseName}${ext}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    ElMessage.success(`已导出 ${baseName}${ext}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    ElMessage.error(`导出失败: ${message}`)
    return
  }

  visible.value = false
}
</script>

<style scoped>
.export-format-group {
  display: flex;
  flex-wrap: wrap;
}
</style>
