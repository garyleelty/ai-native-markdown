/**
 * Markdown 渲染 Web Worker
 * 将耗时的 Markdown 解析和语法高亮移到后台线程
 */

import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import taskLists from 'markdown-it-task-lists'
import anchor from 'markdown-it-anchor'

// 初始化 markdown-it 实例
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight(str: string, lang: string): string {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return `<pre class="hljs"><code>${hljs.highlight(str, { language: lang }).value}</code></pre>`
      } catch {}
    }
    return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`
  }
})

md.use(taskLists, { enabled: true, label: true })
md.use(anchor, {
  permalink: anchor.permalink.linkInsideHeader({
    symbol: '#',
    placement: 'before',
    renderAttrs: () => ({ class: 'header-anchor', href: 'javascript:void(0)' })
  })
})

// 处理 Mermaid 代码块
function processMermaid(content: string): string {
  const fenceRe = /^```mermaid\n([\s\S]*?)^```$/gm
  let result = content
  let match
  const replacements: { start: number; end: number; html: string }[] = []
  
  while ((match = fenceRe.exec(content)) !== null) {
    const diagram = match[1].trim()
    const id = 'mermaid-' + Math.random().toString(36).slice(2)
    const html = `<div class="mermaid" id="${id}">${md.utils.escapeHtml(diagram)}</div>`
    replacements.push({ 
      start: match.index, 
      end: match.index + match[0].length, 
      html 
    })
  }
  
  for (let i = replacements.length - 1; i >= 0; i--) {
    const r = replacements[i]
    result = result.slice(0, r.start) + r.html + result.slice(r.end)
  }
  
  return result
}

// 处理 Wiki 链接
function processWikiLinks(content: string): string {
  return content.replace(/\[\[([^\]]+)\]\]/g, '<a class="wiki-link" data-filename="$1">$1</a>')
}

// 监听主线程消息
self.onmessage = (event: MessageEvent<{ content: string; type: string }>) => {
  const { content, type } = event.data
  
  try {
    if (type === 'render') {
      // 预处理内容
      let processed = processWikiLinks(content)
      processed = processMermaid(processed)
      
      // 渲染 Markdown
      const html = md.render(processed)
      
      // 返回结果
      self.postMessage({ 
        type: 'result', 
        html,
        success: true 
      })
    }
  } catch (error) {
    self.postMessage({ 
      type: 'error', 
      error: error instanceof Error ? error.message : 'Unknown error',
      success: false 
    })
  }
}

export {}
