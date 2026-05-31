import { ElMessage } from 'element-plus'
import { useEditorStore } from '@/stores/editor'
import MarkdownIt from 'markdown-it'

export function useExport() {
  const editorStore = useEditorStore()

  const renderSimpleHTML = (md: string): string => {
    const renderer = new MarkdownIt({ html: true, linkify: true, typographer: true })
    return renderer.render(md)
  }

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

  const exportAsHTML = () => {
    const content = editorStore.content
    const fileName = editorStore.currentFile ? editorStore.currentFile.split('/').pop()?.replace(/\.md$/i, '.html') || 'document.html' : 'document.html'
    const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${fileName.replace('.html', '')}</title><style>body{max-width:800px;margin:0 auto;padding:20px;font-family:system-ui,sans-serif;line-height:1.6}code{background:#f4f4f4;padding:2px 6px;border-radius:3px}pre{background:#f4f4f4;padding:16px;border-radius:8px;overflow-x:auto}img{max-width:100%}</style></head><body>${renderSimpleHTML(content)}</body></html>`
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
    else if (command === 'html') exportAsHTML()
  }

  return {
    exportAsMarkdown,
    exportAsHTML,
    handleExport,
  }
}
