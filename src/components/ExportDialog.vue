<template>
  <el-dialog v-model="visible" title="导出文档" width="480px" class="responsive-dialog" @close="$emit('update:modelValue', false)">
    <el-form label-position="top">
      <el-form-item label="导出格式">
        <el-radio-group v-model="format" class="export-format-group">
          <el-radio-button value="markdown">Markdown</el-radio-button>
          <el-radio-button value="html">HTML</el-radio-button>
          <el-radio-button value="pdf">PDF (浏览器打印)</el-radio-button>
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

const format = ref<'markdown' | 'html' | 'pdf' | 'plain'>('markdown')
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

const handleExport = async () => {
  let blob: Blob
  let name: string
  const baseName = normalizeBaseName(fileName.value)

  try {
    if (format.value === 'markdown') {
      blob = new Blob([props.content], { type: 'text/markdown' })
      name = `${baseName}.md`
    } else if (format.value === 'html') {
      const html = await createExportHtmlWithEmbeds(props.content, {
        title: baseName,
        includeStyles: includeStyles.value,
        includeTOC: includeTOC.value,
        currentFile: props.currentFile,
      })
      blob = new Blob([html], { type: 'text/html' })
      name = `${baseName}.html`
    } else if (format.value === 'pdf') {
      // PDF export via browser print dialog
      const html = await createExportHtmlWithEmbeds(props.content, {
        title: baseName,
        includeStyles: true,
        includeTOC: includeTOC.value,
        currentFile: props.currentFile,
      })
      const printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.write(html)
        printWindow.document.close()
        printWindow.onload = () => {
          printWindow.print()
        }
      }
      visible.value = false
      return
    } else {
      const text = props.content
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/\*(.+?)\*/g, '$1')
        .replace(/`(.+?)`/g, '$1')
        .replace(/\[(.+?)\]\(.+?\)/g, '$1')
        .replace(/!\[.*?\]\(.+?\)/g, '[图片]')
      blob = new Blob([text], { type: 'text/plain' })
      name = `${baseName}.txt`
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    ElMessage.error(`导出失败: ${message}`)
    return
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  visible.value = false
  ElMessage.success(`已导出 ${name}`)
}
</script>

<style scoped>
.export-format-group {
  display: flex;
  flex-wrap: wrap;
}
</style>
