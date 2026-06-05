<template>
  <div class="preview-container">
    <div
      class="preview-content markdown-body"
      ref="previewRef"
      v-html="renderedContent"
      @click="handleClick"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js/lib/common'
import taskLists from 'markdown-it-task-lists'
import anchor from 'markdown-it-anchor'
import katex from '@traptitech/markdown-it-katex'
import { sanitizeMarkdown, sanitizeSvg } from '@/utils/security'
import { resolveWikiLinkTarget } from '@/utils/wikiLinks'

interface Props {
  content?: string
  cursorLine?: number
  currentFile?: string
  markdownPaths?: string[]
}

const props = withDefaults(defineProps<Props>(), {
  content: '',
  cursorLine: 0,
  currentFile: '',
  markdownPaths: () => [],
})
const emit = defineEmits<{
  navigate: [filename: string]
  'heading-click': [line: number]
}>()

const previewRef = ref<HTMLElement>()
const previewContainer = previewRef
const debouncedContent = ref(props.content)
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let mermaidBlockId = 0
let mermaidRenderVersion = 0

watch(() => props.content, () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debouncedContent.value = props.content
  }, 300)
})

const md: MarkdownIt = new MarkdownIt({
  html: false,
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

const SOURCE_LINE_BLOCK_TOKENS = new Set([
  'blockquote_open',
  'bullet_list_open',
  'code_block',
  'fence',
  'heading_open',
  'hr',
  'html_block',
  'list_item_open',
  'ordered_list_open',
  'paragraph_open',
  'table_open',
])

md.core.ruler.push('source_line_attrs', (state: any) => {
  for (const token of state.tokens) {
    if (!SOURCE_LINE_BLOCK_TOKENS.has(token.type) || !token.map) continue
    const [start, end] = token.map
    token.attrSet('data-line', String(start + 1))
    token.attrSet('data-line-end', String(Math.max(start + 1, end)))
  }
})

md.use(taskLists, { enabled: true, label: true })
md.use(anchor, {
  permalink: anchor.permalink.linkInsideHeader({
    symbol: '#',
    placement: 'before',
    renderAttrs: () => ({ class: 'header-anchor', href: '#' })
  })
})
md.use(katex, { throwOnError: false, errorColor: 'var(--accent-red)' })

md.inline.ruler.before('emphasis', 'wiki_link', (state: any, silent: boolean) => {
  const start = state.pos
  if (state.src.charCodeAt(start) !== 0x5B || state.src.charCodeAt(start + 1) !== 0x5B) return false

  const end = state.src.indexOf(']]', start + 2)
  if (end === -1) return false

  const raw = state.src.slice(start + 2, end)
  if (!raw.trim() || raw.includes('\n')) return false

  if (!silent) {
    const pipeIndex = raw.indexOf('|')
    const target = (pipeIndex === -1 ? raw : raw.slice(0, pipeIndex)).trim()
    const text = pipeIndex === -1 ? target : raw.slice(pipeIndex + 1).trim()
    if (!target) return false

    const exists = resolveWikiLinkTarget(target, props.currentFile, props.markdownPaths) !== null
    const stateClass = exists ? 'wiki-link-exists' : 'wiki-link-missing'
    const linkOpen = state.push('link_open', 'a', 1)
    linkOpen.attrSet('href', '#')
    linkOpen.attrSet('class', `wiki-link ${stateClass}`)
    linkOpen.attrSet('data-filename', target)

    const textToken = state.push('text', '', 0)
    textToken.content = text || target

    state.push('link_close', 'a', -1)
  }

  state.pos = end + 2
  return true
})

const defaultFenceRenderer = md.renderer.rules.fence?.bind(md.renderer.rules)
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  const lang = token.info.trim().split(/\s+/)[0]
  const lineAttrs = sourceLineAttrs(token)
  if (lang === 'mermaid') {
    const diagram = token.content.trim()
    const id = `mermaid-${mermaidBlockId++}`
    return `<div class="mermaid" id="${id}"${lineAttrs}>${md.utils.escapeHtml(diagram)}</div>`
  }
  if (defaultFenceRenderer) {
    return withSourceLineAttrs(defaultFenceRenderer(tokens, idx, options, env, self), lineAttrs)
  }
  return self.renderToken(tokens, idx, options)
}

const lineMap = ref<Map<number, HTMLElement>>(new Map())

function sourceLineAttrs(token: any): string {
  const start = token.attrGet?.('data-line')
  const end = token.attrGet?.('data-line-end')
  if (!start) return ''
  return ` data-line="${md.utils.escapeHtml(start)}"${end ? ` data-line-end="${md.utils.escapeHtml(end)}"` : ''}`
}

function withSourceLineAttrs(html: string, attrs: string): string {
  if (!attrs || !html.startsWith('<pre')) return html
  return html.replace('<pre', `<pre${attrs}`)
}

function buildLineMap() {
  const map = new Map<number, HTMLElement>()
  if (!previewRef.value) return map
  const lineElements = Array.from(previewRef.value.querySelectorAll<HTMLElement>('[data-line]'))
  for (const el of lineElements) {
    const start = parseInt(el.dataset.line || '0', 10)
    const end = parseInt(el.dataset.lineEnd || el.dataset.line || '0', 10)
    if (!Number.isFinite(start) || start <= 0) continue
    const boundedEnd = Number.isFinite(end) && end >= start ? end : start
    for (let line = start; line <= boundedEnd; line++) {
      if (!map.has(line)) map.set(line, el)
    }
  }
  return map
}

function findElementForLine(line: number): HTMLElement | undefined {
  if (line <= 0 || lineMap.value.size === 0) return undefined
  const exact = lineMap.value.get(line)
  if (exact) return exact
  const sortedLines = Array.from(lineMap.value.keys()).sort((a, b) => a - b)
  const following = sortedLines.find((mappedLine) => mappedLine >= line)
  const fallbackLine = following ?? sortedLines[sortedLines.length - 1]
  return lineMap.value.get(fallbackLine)
}

const renderedContent = computed(() => {
  mermaidBlockId = 0
  return sanitizeMarkdown(md.render(debouncedContent.value))
})

let mermaidInstance: any = null

async function getMermaid() {
  if (!mermaidInstance) {
    const mod = await import('mermaid')
    mermaidInstance = mod.default
    mermaidInstance.initialize({ startOnLoad: false, theme: 'default' })
  }
  return mermaidInstance
}

async function renderMermaid(): Promise<boolean> {
  const renderVersion = ++mermaidRenderVersion
  await nextTick()
  const root = previewRef.value
  if (!root) return false
  const els = root.querySelectorAll<HTMLElement>('.mermaid')
  if (els.length === 0) return renderVersion === mermaidRenderVersion
  const mermaid = await getMermaid()
  if (renderVersion !== mermaidRenderVersion || previewRef.value !== root) return false
  for (const [index, el] of Array.from(els).entries()) {
    const graphDefinition = el.textContent || ''
    try {
      const { svg } = await mermaid.render(
        `mermaid-svg-${renderVersion}-${index}`,
        graphDefinition
      )
      if (renderVersion !== mermaidRenderVersion || previewRef.value !== root || !root.contains(el)) return false
      el.innerHTML = sanitizeSvg(svg)
    } catch {
      if (renderVersion !== mermaidRenderVersion || previewRef.value !== root || !root.contains(el)) return false
      el.textContent = 'Mermaid diagram error'
    }
  }
  return renderVersion === mermaidRenderVersion
}

function highlightCurrentLine() {
  if (!previewRef.value) return
  previewRef.value.querySelectorAll('.current-line').forEach((el) => {
    el.classList.remove('current-line')
  })
  const el = findElementForLine(props.cursorLine)
  if (el) {
    el.classList.add('current-line')
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

let renderTimer: ReturnType<typeof setTimeout> | null = null

watch(renderedContent, () => {
  if (renderTimer) clearTimeout(renderTimer)
  renderTimer = setTimeout(async () => {
    const renderedCurrentContent = await renderMermaid()
    if (!renderedCurrentContent) return
    lineMap.value = buildLineMap()
    highlightCurrentLine()
  }, 150)
}, { flush: 'post' })

watch(() => props.cursorLine, async () => {
  await nextTick()
  highlightCurrentLine()
})

function handleClick(event: MouseEvent) {
  const target = event.target as HTMLElement
  const anchor = target.closest('.header-anchor') as HTMLElement | null
  if (anchor) {
    event.preventDefault()
    const heading = anchor.closest('h1, h2, h3, h4, h5, h6') as HTMLElement | null
    if (heading) {
      const line = parseInt(heading.dataset.line || '1', 10)
      emit('heading-click', line)
    }
    return
  }
  const wikiLink = target.closest('.wiki-link') as HTMLElement | null
  if (wikiLink) {
    event.preventDefault()
    const filename = wikiLink.dataset.filename
    if (filename) emit('navigate', filename)
    return
  }
}

onMounted(() => {
  renderMermaid().then((renderedCurrentContent) => {
    if (!renderedCurrentContent) return
    lineMap.value = buildLineMap()
  })
})

onUnmounted(() => {
  mermaidRenderVersion += 1
  if (renderTimer !== null) { clearTimeout(renderTimer); renderTimer = null }
  if (debounceTimer !== null) { clearTimeout(debounceTimer); debounceTimer = null }
})

const scrollToLine = (line: number) => {
  const container = previewContainer.value
  if (!container) return
  const el = findElementForLine(line)
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

defineExpose({
  scrollToLine
})
</script>

<style scoped>
.preview-container {
  height: 100%;
  overflow: hidden;
  background: var(--obsidian-bg-primary);
}

.preview-content {
  height: 100%;
  overflow-y: auto;
  padding: var(--space-8) var(--space-10);
  max-width: 820px;
  margin: 0 auto;
}

.markdown-body {
  color: var(--obsidian-text-normal);
  font-size: 15px;
  line-height: 1.8;
  letter-spacing: 0.008em;
  font-weight: 400;
}

.markdown-body h1, .markdown-body h2, .markdown-body h3,
.markdown-body h4, .markdown-body h5, .markdown-body h6 {
  margin-top: 1.8em;
  margin-bottom: 0.65em;
  font-weight: 600;
  line-height: 1.35;
  color: var(--obsidian-text-normal);
  letter-spacing: -0.02em;
  position: relative;
}

.markdown-body h1 {
  font-size: 28px;
  padding-bottom: 0.35em;
  border-bottom: 1px solid var(--obsidian-border);
}
.markdown-body h2 {
  font-size: 24px;
  padding-bottom: 0.3em;
  border-bottom: 1px solid var(--obsidian-border);
}

.markdown-body h3 {
  font-size: 20px;
  font-weight: 600;
}
.markdown-body h4 {
  font-size: 1.08em;
}

.markdown-body h1:first-child, .markdown-body h2:first-child,
.markdown-body h3:first-child {
  margin-top: 0;
}

.markdown-body .header-anchor {
  color: var(--obsidian-text-muted);
  text-decoration: none;
  margin-right: 0.4em;
  opacity: 0;
  transition: opacity 0.15s ease;
  cursor: pointer;
}
.markdown-body h1:hover .header-anchor,
.markdown-body h2:hover .header-anchor,
.markdown-body h3:hover .header-anchor,
.markdown-body h4:hover .header-anchor,
.markdown-body h5:hover .header-anchor,
.markdown-body h6:hover .header-anchor {
  opacity: 1;
}

.markdown-body p {
  margin-bottom: 1.15em;
}

.markdown-body strong {
  color: var(--obsidian-text-normal);
  font-weight: 700;
}

.markdown-body em {
  font-style: italic;
}

.markdown-body a {
  color: var(--obsidian-accent);
  text-decoration: none;
}
.markdown-body a:hover {
  text-decoration: underline;
}

.markdown-body .wiki-link {
  color: var(--obsidian-accent);
  cursor: pointer;
}

.markdown-body .wiki-link-missing {
  color: var(--obsidian-text-muted);
  text-decoration-line: underline;
  text-decoration-style: dashed;
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
}

.markdown-body .wiki-link-missing:hover {
  color: var(--obsidian-accent);
  text-decoration-style: solid;
}

.markdown-body code {
  background: var(--obsidian-bg-secondary);
  color: var(--obsidian-accent);
  padding: 2px 6px;
  border-radius: 0;
  font-family: var(--font-mono);
  font-size: 0.87em;
  font-weight: 500;
}

.markdown-body pre {
  background: var(--obsidian-bg-secondary);
  padding: 16px 20px;
  border-radius: 0;
  overflow-x: auto;
  margin: 1.4em 0;
  border: none;
  position: relative;
}
.markdown-body pre code {
  background: none;
  color: var(--obsidian-text-normal);
  padding: 0;
  font-size: 0.86em;
  line-height: 1.65;
  border: none;
  display: block;
}

.markdown-body ul, .markdown-body ol {
  padding-left: 1.75em;
  margin-bottom: 1.15em;
}
.markdown-body li {
  margin-bottom: 0.45em;
  line-height: 1.7;
}
.markdown-body li::marker {
  color: var(--obsidian-text-muted);
}

.markdown-body .task-list-item {
  list-style-type: none;
  padding-left: 0;
}
.markdown-body .task-list-item input[type="checkbox"] {
  accent-color: var(--obsidian-accent);
  width: 16px;
  height: 16px;
  cursor: pointer;
  margin-right: 8px;
  vertical-align: middle;
}

.markdown-body blockquote {
  border-left: 2px solid var(--obsidian-accent);
  padding: 0.6em 1.2em;
  margin: 1.3em 0;
  color: var(--obsidian-text-muted);
  background: transparent;
  border-radius: 0;
}
.markdown-body blockquote p:last-child {
  margin-bottom: 0;
}

.markdown-body hr {
  border: none;
  height: 1px;
  background: var(--obsidian-border);
  margin: 2.5em 0;
}

.markdown-body table {
  border-collapse: collapse;
  border-spacing: 0;
  width: 100%;
  margin: 1.3em 0;
  font-size: 0.93em;
  border: 1px solid var(--obsidian-border);
}
.markdown-body th, .markdown-body td {
  border: 1px solid var(--obsidian-border);
  padding: 8px 12px;
  text-align: left;
}
.markdown-body th {
  background: var(--obsidian-bg-secondary);
  font-weight: 600;
  color: var(--obsidian-text-normal);
  font-size: 0.85em;
}
.markdown-body tr:hover td {
  background: var(--obsidian-bg-hover);
}

.markdown-body img {
  max-width: 100%;
  border-radius: var(--radius-sm);
  margin: 1.3em 0;
}

.markdown-body .mermaid {
  background: var(--obsidian-bg-secondary);
  padding: 16px 20px;
  border-radius: 0;
  margin: 1.4em 0;
  border: none;
  overflow-x: auto;
  text-align: center;
}

.markdown-body .katex {
  font-size: 1.05em;
}
.markdown-body .katex-display {
  margin: 1.4em 0;
  overflow-x: auto;
}

.hljs {
  background: transparent !important;
  color: var(--obsidian-text-normal) !important;
}

.current-line {
  background: var(--obsidian-bg-hover);
  border-radius: var(--radius-sm);
  transition: background 0.15s ease;
}
</style>
