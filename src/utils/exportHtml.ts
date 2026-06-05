import MarkdownIt from 'markdown-it'
import type Token from 'markdown-it/lib/token.mjs'
import anchor from 'markdown-it-anchor'
import taskLists from 'markdown-it-task-lists'
import katex from '@traptitech/markdown-it-katex'
import { escapeHtml, sanitizeMarkdown } from './security'

interface HeadingEntry {
  level: number
  slug: string
  title: string
}

interface ExportHtmlOptions {
  title: string
  includeStyles?: boolean
  includeTOC?: boolean
}

const EXPORT_STYLES = `<style>body{max-width:800px;margin:0 auto;padding:20px 40px;font-family:system-ui,-apple-system,sans-serif;line-height:1.7;color:#333}h1,h2,h3{margin-top:1.5em}a{color:#0366d6}code{background:#f6f8fa;padding:2px 6px;border-radius:3px;font-size:85%}pre{background:#f6f8fa;padding:16px;border-radius:6px;overflow-x:auto}pre code{background:none;padding:0}blockquote{border-left:4px solid #dfe2e5;padding:0 16px;color:#666}table{border-collapse:collapse;width:100%}th,td{border:1px solid #dfe2e5;padding:8px 12px}th{background:#f6f8fa}img{max-width:100%}.export-toc{border:1px solid #dfe2e5;border-radius:8px;padding:16px 18px;margin:0 0 24px;background:#f8fafc}.export-toc-title{font-weight:700;margin-bottom:8px}.export-toc ul{list-style:none;margin:0;padding:0}.export-toc li{margin:4px 0}.export-toc-level-2{padding-left:16px}.export-toc-level-3{padding-left:32px}hr{border:none;border-top:1px solid #eee;margin:2em 0}</style>`

/**
 * Create a MarkdownIt instance with the same plugin set as Preview.vue,
 * ensuring exported HTML matches the preview rendering.
 */
export function createMarkdownRenderer(headings: HeadingEntry[]): MarkdownIt {
  const md = new MarkdownIt({ html: false, linkify: true, typographer: true })
  md.use(taskLists, { enabled: true, label: true })
  md.use(anchor, {
    callback(token: Token, info) {
      const level = Number(token.tag.slice(1))
      headings.push({ level, slug: info.slug, title: info.title })
    },
  })
  md.use(katex, { throwOnError: false })
  return md
}

function renderTOC(headings: HeadingEntry[]): string {
  const tocItems = headings
    .filter(heading => heading.level >= 1 && heading.level <= 3)
    .map(heading => {
      const title = escapeHtml(heading.title)
      const slug = escapeHtml(heading.slug)
      return `<li class="export-toc-level-${heading.level}"><a href="#${slug}">${title}</a></li>`
    })

  if (tocItems.length === 0) return ''

  return `<nav class="export-toc" aria-label="目录"><div class="export-toc-title">目录</div><ul>${tocItems.join('')}</ul></nav><hr>`
}

export function renderMarkdownBody(markdown: string): string {
  const headings: HeadingEntry[] = []
  return sanitizeMarkdown(createMarkdownRenderer(headings).render(markdown))
}

export function createExportHtml(markdown: string, options: ExportHtmlOptions): string {
  const headings: HeadingEntry[] = []
  const md = createMarkdownRenderer(headings)
  const body = sanitizeMarkdown(md.render(markdown))
  const toc = options.includeTOC ? renderTOC(headings) : ''
  const styles = options.includeStyles === false ? '' : EXPORT_STYLES
  const title = escapeHtml(options.title)

  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>${styles}</head><body>${toc}${body}</body></html>`
}
