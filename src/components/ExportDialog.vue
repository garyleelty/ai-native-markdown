<template>
  <el-dialog v-model="visible" title="导出文档" width="480px" @close="$emit('update:modelValue', false)">
    <el-form label-position="top">
      <el-form-item label="导出格式">
        <el-radio-group v-model="format">
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
        <el-form-item label="独立文件（内联 CSS）">
          <el-switch v-model="standalone" />
        </el-form-item>
      </template>

      <el-form-item label="文件名">
        <el-input v-model="fileName" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" @click="handleExport">导出</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import MarkdownIt from 'markdown-it'

const props = defineProps<{
  modelValue: boolean
  content: string
  defaultFileName?: string
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
const standalone = ref(true)
const fileName = ref(props.defaultFileName || 'document')

watch(() => props.defaultFileName, (newName) => {
  if (newName) fileName.value = newName
})

const handleExport = () => {
  let blob: Blob
  let name: string

  if (format.value === 'markdown') {
    blob = new Blob([props.content], { type: 'text/markdown' })
    name = `${fileName.value}.md`
  } else if (format.value === 'html') {
    const md = new MarkdownIt({ html: true, linkify: true, typographer: true })
    let body = md.render(props.content)

    if (includeTOC.value) {
      const headings = props.content.match(/^#{1,3}\s+.+$/gm) || []
      if (headings.length > 0) {
        const toc = headings.map(h => {
          const level = h.match(/^#+/)?.[0].length || 1
          const text = h.replace(/^#+\s+/, '')
          const id = text.toLowerCase().replace(/\s+/g, '-')
          return `${'  '.repeat(level - 1)}- [${text}](#${id})`
        }).join('\n')
        body = md.render(toc) + '<hr>' + body
      }
    }

    const styles = includeStyles.value ? `<style>body{max-width:800px;margin:0 auto;padding:20px 40px;font-family:system-ui,-apple-system,sans-serif;line-height:1.7;color:#333}h1,h2,h3{margin-top:1.5em}a{color:#0366d6}code{background:#f6f8fa;padding:2px 6px;border-radius:3px;font-size:85%}pre{background:#f6f8fa;padding:16px;border-radius:6px;overflow-x:auto}pre code{background:none;padding:0}blockquote{border-left:4px solid #dfe2e5;padding:0 16px;color:#666}table{border-collapse:collapse;width:100%}th,td{border:1px solid #dfe2e5;padding:8px 12px}th{background:#f6f8fa}img{max-width:100%}hr{border:none;border-top:1px solid #eee;margin:2em 0}</style>` : ''
    const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${fileName.value}</title>${styles}</head><body>${body}</body></html>`
    blob = new Blob([html], { type: 'text/html' })
    name = `${fileName.value}.html`
  } else {
    const text = props.content
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/`(.+?)`/g, '$1')
      .replace(/\[(.+?)\]\(.+?\)/g, '$1')
      .replace(/!\[.*?\]\(.+?\)/g, '[图片]')
    blob = new Blob([text], { type: 'text/plain' })
    name = `${fileName.value}.txt`
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
