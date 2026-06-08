import { ElMessage } from 'element-plus'
import { useEditorStore } from '@/stores/editor'
import { createExportHtmlWithEmbeds } from '@/utils/exportHtml'

export function useExport() {
  const editorStore = useEditorStore()

  const exportAsMarkdown = () => {
    const content = editorStore.content
    const fileName = editorStore.currentFile ? editorStore.currentFile.split('/').pop() || 'document.md' : 'document.md'
    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    ElMessage.success('已导出 Markdown')
  }

  const exportAsHTML = async () => {
    const content = editorStore.content
    const fileName = editorStore.currentFile ? editorStore.currentFile.split('/').pop()?.replace(/\.md$/i, '.html') || 'document.html' : 'document.html'
    const htmlContent = await createExportHtmlWithEmbeds(content, {
      title: fileName.replace(/\.html$/i, ''),
      includeStyles: true,
      includeTOC: false,
      currentFile: editorStore.currentFile,
    })
    const blob = new Blob([htmlContent], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    ElMessage.success('已导出 HTML')
  }

  const handleExport = (command: string) => {
    if (command === 'markdown') exportAsMarkdown()
    else if (command === 'html') void exportAsHTML()
  }

  return {
    exportAsMarkdown,
    exportAsHTML,
    handleExport,
  }
}
