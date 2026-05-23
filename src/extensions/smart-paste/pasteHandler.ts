import { EditorView } from '@codemirror/view'

function cleanPastedContent(text: string): string {
  // 1. 将常见的智能引号转为普通引号
  text = text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')

  // 2. 将非换行空格转为普通空格（保留缩进用的空格）
  text = text.replace(/\u00A0/g, ' ')

  // 3. 移除零宽字符
  text = text.replace(/[\u200B-\u200D\uFEFF]/g, '')

  // 4. 规范化换行：3个以上的连续换行压缩为2个
  text = text.replace(/\n{3,}/g, '\n\n')

  // 5. 移除行尾空白
  text = text.split('\n').map(line => line.trimEnd()).join('\n')

  return text
}

function convertHTMLToMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')

  function processNode(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || ''
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return ''

    const el = node as HTMLElement
    const children = Array.from(el.childNodes).map(processNode).join('')

    switch (el.tagName.toLowerCase()) {
      case 'h1': return `# ${children}\n\n`
      case 'h2': return `## ${children}\n\n`
      case 'h3': return `### ${children}\n\n`
      case 'h4': return `#### ${children}\n\n`
      case 'h5': return `##### ${children}\n\n`
      case 'h6': return `###### ${children}\n\n`
      case 'p': return `${children}\n\n`
      case 'br': return '\n'
      case 'strong': case 'b': return `**${children}**`
      case 'em': case 'i': return `*${children}*`
      case 'code': return `\`${children}\``
      case 'pre': return `\`\`\`\n${children}\n\`\`\`\n\n`
      case 'a': {
        const href = el.getAttribute('href') || ''
        return `[${children}](${href})`
      }
      case 'img': {
        const src = el.getAttribute('src') || ''
        const alt = el.getAttribute('alt') || ''
        return `![${alt}](${src})`
      }
      case 'ul': return `\n${children}\n`
      case 'ol': return `\n${children}\n`
      case 'li': {
        const parent = el.parentElement
        if (parent?.tagName.toLowerCase() === 'ol') {
          return `1. ${children}\n`
        }
        return `- ${children}\n`
      }
      case 'blockquote': {
        return children.split('\n').filter(l => l).map(l => `> ${l}`).join('\n') + '\n\n'
      }
      case 'hr': return '---\n\n'
      case 'div': case 'section': case 'article': case 'span':
        return children
      default:
        return children
    }
  }

  return processNode(doc.body).replace(/\n{3,}/g, '\n\n').trim() + '\n'
}

export const smartPasteExtension = EditorView.domEventHandlers({
  paste(event, view) {
    const clipboardData = event.clipboardData
    if (!clipboardData) return false

    // 获取 HTML 和纯文本
    const html = clipboardData.getData('text/html')
    const plainText = clipboardData.getData('text/plain')

    // 如果有 HTML 内容（来自富文本源），尝试转换为 Markdown
    if (html) {
      event.preventDefault()

      try {
        const markdown = convertHTMLToMarkdown(html)
        const cleaned = cleanPastedContent(markdown)

        const { from, to } = view.state.selection.main
        view.dispatch({
          changes: { from, to, insert: cleaned },
          selection: { anchor: from + cleaned.length }
        })
        return true
      } catch {
        // HTML 解析失败，降级到纯文本
      }
    }

    // 纯文本粘贴：只做基础清理
    if (plainText) {
      event.preventDefault()

      const cleaned = cleanPastedContent(plainText)

      const { from, to } = view.state.selection.main
      view.dispatch({
        changes: { from, to, insert: cleaned },
        selection: { anchor: from + cleaned.length }
      })
      return true
    }

    return false
  }
})