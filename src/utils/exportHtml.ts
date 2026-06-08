import MarkdownIt from 'markdown-it'
import type Token from 'markdown-it/lib/token.mjs'
import anchor from 'markdown-it-anchor'
import taskLists from 'markdown-it-task-lists'
import katex from '@traptitech/markdown-it-katex'
import { escapeHtml, sanitizeMarkdown } from './security'
import { embedPlugin } from './markdown/embedPlugin'

interface HeadingEntry {
  level: number
  slug: string
  title: string
}

interface ExportHtmlOptions {
  title: string
  includeStyles?: boolean
  includeTOC?: boolean
  currentFile?: string
}

export interface CreateMarkdownRendererOptions {
  headings?: HeadingEntry[]
  highlight?: (str: string, lang: string) => string
  sourceLineAttrs?: boolean
  wikiLinkRule?: (state: any, silent: boolean) => boolean
  anchorPermalink?: boolean
}

/**
 * Create a MarkdownIt instance with the shared plugin set,
 * ensuring exported HTML matches the preview rendering.
 * Both Preview.vue and exportHtml.ts must use this factory.
 */
export function createMarkdownRenderer(options: CreateMarkdownRendererOptions = {}): MarkdownIt {
  const { headings = [], highlight, sourceLineAttrs = false, wikiLinkRule, anchorPermalink = false } = options
  const md = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: true,
    highlight,
  })
  md.use(taskLists, { enabled: true, label: true })
  md.use(anchor, {
    ...(anchorPermalink
      ? {
          permalink: anchor.permalink.linkInsideHeader({
            symbol: '#',
            placement: 'before',
            renderAttrs: () => ({ class: 'header-anchor', href: '#' }),
          }),
        }
      : {
          callback(token: Token, info) {
            const level = Number(token.tag.slice(1))
            headings.push({ level, slug: info.slug, title: info.title })
          },
        }),
  })
  md.use(katex, { throwOnError: false, ...(anchorPermalink ? { errorColor: 'var(--accent-red)' } : {}) })
  md.use(embedPlugin)

  if (sourceLineAttrs) {
    const SOURCE_LINE_BLOCK_TOKENS = new Set([
      'blockquote_open', 'bullet_list_open', 'code_block', 'fence',
      'heading_open', 'hr', 'html_block', 'list_item_open',
      'ordered_list_open', 'paragraph_open', 'table_open',
    ])
    md.core.ruler.push('source_line_attrs', (state: any) => {
      for (const token of state.tokens) {
        if (!SOURCE_LINE_BLOCK_TOKENS.has(token.type) || !token.map) continue
        const [start, end] = token.map
        token.attrSet('data-line', String(start + 1))
        token.attrSet('data-line-end', String(Math.max(start + 1, end)))
      }
    })
  }

  if (wikiLinkRule) {
    md.inline.ruler.before('emphasis', 'wiki_link', wikiLinkRule)
  }

  return md
}

const EXPORT_STYLES = `<style>body{max-width:800px;margin:0 auto;padding:20px 40px;font-family:system-ui,-apple-system,sans-serif;line-height:1.7;color:#333}h1,h2,h3{margin-top:1.5em}a{color:#0366d6}code{background:#f6f8fa;padding:2px 6px;border-radius:3px;font-size:85%}pre{background:#f6f8fa;padding:16px;border-radius:6px;overflow-x:auto}pre code{background:none;padding:0}blockquote{border-left:4px solid #dfe2e5;padding:0 16px;color:#666}table{border-collapse:collapse;width:100%}th,td{border:1px solid #dfe2e5;padding:8px 12px}th{background:#f6f8fa}img{max-width:100%}.embed{border-left:3px solid #d0d7de;background:#f8fafc;padding:12px 16px;margin:1.25em 0}.embed-header{font-size:12px;color:#57606a;margin-bottom:8px}.embed-source{all:unset;cursor:pointer;color:#0969da}.embed-content>*:first-child{margin-top:0}.embed-content>*:last-child{margin-bottom:0}.embed-image img,.embed-video video,.embed-audio audio,.embed-pdf iframe{display:block;width:100%;max-width:100%}.embed-video video{max-height:420px;background:#000}.embed-audio audio{min-height:36px}.embed-pdf-frame{height:70vh;min-height:420px;border:1px solid #d0d7de;background:#fff}.embed-not-found{border-color:#cf222e;background:#fff5f5}.embed-error{color:#cf222e}.export-toc{border:1px solid #dfe2e5;border-radius:8px;padding:16px 18px;margin:0 0 24px;background:#f8fafc}.export-toc-title{font-weight:700;margin-bottom:8px}.export-toc ul{list-style:none;margin:0;padding:0}.export-toc li{margin:4px 0}.export-toc-level-2{padding-left:16px}.export-toc-level-3{padding-left:32px}hr{border:none;border-top:1px solid #eee;margin:2em 0}</style>`

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
  return sanitizeMarkdown(createMarkdownRenderer({ headings }).render(markdown))
}

export async function renderMarkdownBodyWithEmbeds(markdown: string, currentFile?: string): Promise<string> {
  const headings: HeadingEntry[] = []
  const wrapper = document.createElement('div')
  wrapper.innerHTML = sanitizeMarkdown(createMarkdownRenderer({ headings }).render(markdown))
  const { resolveEmbedPlaceholders } = await import('@/services/embedRenderer')
  await resolveEmbedPlaceholders(wrapper, { sourcePath: currentFile, currentContent: markdown })
  return wrapper.innerHTML
}

export function createExportHtml(markdown: string, options: ExportHtmlOptions): string {
  const headings: HeadingEntry[] = []
  const md = createMarkdownRenderer({ headings })
  const body = sanitizeMarkdown(md.render(markdown))
  const toc = options.includeTOC ? renderTOC(headings) : ''
  const styles = options.includeStyles === false ? '' : EXPORT_STYLES
  const title = escapeHtml(options.title)

  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>${styles}</head><body>${toc}${body}</body></html>`
}

export async function createExportHtmlWithEmbeds(markdown: string, options: ExportHtmlOptions): Promise<string> {
  const headings: HeadingEntry[] = []
  const md = createMarkdownRenderer({ headings })
  const wrapper = document.createElement('div')
  wrapper.innerHTML = sanitizeMarkdown(md.render(markdown))
  const { resolveEmbedPlaceholders } = await import('@/services/embedRenderer')
  await resolveEmbedPlaceholders(wrapper, { sourcePath: options.currentFile, currentContent: markdown })
  const toc = options.includeTOC ? renderTOC(headings) : ''
  const styles = options.includeStyles === false ? '' : EXPORT_STYLES
  const title = escapeHtml(options.title)

  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>${styles}</head><body>${toc}${wrapper.innerHTML}</body></html>`
}
