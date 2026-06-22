import { ElMessage } from 'element-plus'
import { useEditorStore } from '@/stores/editor'
import { createExportHtmlWithEmbeds } from '@/utils/exportHtml'
import { ref } from 'vue'

export interface ExportOptions {
  format: 'markdown' | 'html' | 'pdf' | 'docx' | 'txt'
  includeMetadata?: boolean
  includeTableOfContents?: boolean
  includeBacklinks?: boolean
  enhancedFormatting?: boolean
  customStyles?: string
}

export function useExport() {
  const editorStore = useEditorStore()
  const isExporting = ref(false)
  const exportProgress = ref(0)

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

  const exportAsHTML = async (options?: ExportOptions) => {
    const content = editorStore.content
    const fileName = editorStore.currentFile ? editorStore.currentFile.split('/').pop()?.replace(/\.md$/i, '.html') || 'document.html' : 'document.html'

    isExporting.value = true
    exportProgress.value = 0

    try {
      exportProgress.value = 20

      const htmlContent = await createExportHtmlWithEmbeds(content, {
        title: fileName.replace(/\.html$/i, ''),
        includeStyles: true,
        includeTOC: options?.includeTableOfContents || false,
        currentFile: editorStore.currentFile,
      })

      exportProgress.value = 80

      // Add enhanced formatting if requested
      let enhancedHtml = htmlContent
      if (options?.enhancedFormatting) {
        enhancedHtml = enhanceHtmlFormatting(htmlContent)
      }

      // Add custom styles if provided
      if (options?.customStyles) {
        enhancedHtml = enhancedHtml.replace('</head>', `<style>${options.customStyles}</style></head>`)
      }

      exportProgress.value = 100

      const blob = new Blob([enhancedHtml], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      ElMessage.success('已导出 HTML')
    } finally {
      isExporting.value = false
      exportProgress.value = 0
    }
  }

  const exportAsPlainText = () => {
    const content = editorStore.content
    // Remove markdown formatting
    const plainText = content
      .replace(/^#{1,6}\s+/gm, '') // Remove headings
      .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
      .replace(/\*([^*]+)\*/g, '$1') // Remove italic
      .replace(/~~([^~]+)~~/g, '$1') // Remove strikethrough
      .replace(/`([^`]+)`/g, '$1') // Remove inline code
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1') // Remove images
      .replace(/^\s*[-*+]\s+/gm, '') // Remove list markers
      .replace(/^\s*\d+\.\s+/gm, '') // Remove ordered list markers
      .replace(/^\s*>\s+/gm, '') // Remove blockquotes
      .replace(/\n{3,}/g, '\n\n') // Remove extra newlines

    const fileName = editorStore.currentFile ? editorStore.currentFile.split('/').pop()?.replace(/\.md$/i, '.txt') || 'document.txt' : 'document.txt'
    const blob = new Blob([plainText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    ElMessage.success('已导出纯文本')
  }

  // Enhance HTML formatting
  function enhanceHtmlFormatting(html: string): string {
    // Add better typography
    let enhanced = html

    // Add responsive meta tag if not present
    if (!enhanced.includes('viewport')) {
      enhanced = enhanced.replace('<head>', '<head>\n<meta name="viewport" content="width=device-width, initial-scale=1.0">')
    }

    // Add better font stack
    enhanced = enhanced.replace(
      /font-family:\s*[^;]+/g,
      'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    )

    // Add better line height
    enhanced = enhanced.replace(
      /line-height:\s*[^;]+/g,
      'line-height: 1.6'
    )

    // Add better paragraph spacing
    enhanced = enhanced.replace(
      /<p>/g,
      '<p style="margin-bottom: 1em;">'
    )

    // Add better heading styles
    enhanced = enhanced.replace(
      /<h1>/g,
      '<h1 style="margin-top: 2em; margin-bottom: 0.5em; font-size: 2em; font-weight: 600;">'
    )
    enhanced = enhanced.replace(
      /<h2>/g,
      '<h2 style="margin-top: 1.5em; margin-bottom: 0.5em; font-size: 1.5em; font-weight: 600;">'
    )
    enhanced = enhanced.replace(
      /<h3>/g,
      '<h3 style="margin-top: 1.2em; margin-bottom: 0.5em; font-size: 1.25em; font-weight: 600;">'
    )

    // Add better code block styles
    enhanced = enhanced.replace(
      /<pre>/g,
      '<pre style="background: #f6f8fa; padding: 16px; border-radius: 6px; overflow-x: auto; margin: 1em 0;">'
    )
    enhanced = enhanced.replace(
      /<code>/g,
      '<code style="background: #f6f8fa; padding: 2px 6px; border-radius: 3px; font-size: 0.9em;">'
    )

    // Add better blockquote styles
    enhanced = enhanced.replace(
      /<blockquote>/g,
      '<blockquote style="border-left: 4px solid #0366d6; padding: 0.5em 1em; margin: 1em 0; color: #57606a;">'
    )

    // Add better table styles
    enhanced = enhanced.replace(
      /<table>/g,
      '<table style="border-collapse: collapse; width: 100%; margin: 1em 0;">'
    )
    enhanced = enhanced.replace(
      /<th>/g,
      '<th style="border: 1px solid #dfe2e5; padding: 8px 12px; background: #f6f8fa; font-weight: 600;">'
    )
    enhanced = enhanced.replace(
      /<td>/g,
      '<td style="border: 1px solid #dfe2e5; padding: 8px 12px;">'
    )

    return enhanced
  }

  // Export with options
  const exportWithOptions = async (options: ExportOptions) => {
    switch (options.format) {
      case 'markdown':
        exportAsMarkdown()
        break
      case 'html':
        await exportAsHTML(options)
        break
      case 'txt':
        exportAsPlainText()
        break
      case 'pdf':
        ElMessage.info('PDF 导出功能即将推出')
        break
      case 'docx':
        ElMessage.info('Word 导出功能即将推出')
        break
    }
  }

  const handleExport = (command: string) => {
    if (command === 'markdown') exportAsMarkdown()
    else if (command === 'html') void exportAsHTML()
    else if (command === 'txt') exportAsPlainText()
  }

  return {
    exportAsMarkdown,
    exportAsHTML,
    exportAsPlainText,
    exportWithOptions,
    handleExport,
    isExporting,
    exportProgress,
  }
}
