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

interface Props {
  content?: string
  cursorLine?: number
}

const props = withDefaults(defineProps<Props>(), { content: '', cursorLine: 0 })
const emit = defineEmits<{
  navigate: [filename: string]
  'heading-click': [line: number]
}>()

const previewRef = ref<HTMLElement>()
const previewContainer = previewRef
const debouncedContent = ref(props.content)
let debounceTimer: ReturnType<typeof setTimeout> | null = null

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

md.use(taskLists, { enabled: true, label: true })
md.use(anchor, {
  permalink: anchor.permalink.linkInsideHeader({
    symbol: '#',
    placement: 'before',
    renderAttrs: () => ({ class: 'header-anchor', href: 'javascript:void(0)' })
  })
})
md.use(katex, { throwOnError: false, errorColor: 'var(--accent-red)' })

const lineMap = ref<Map<number, HTMLElement>>(new Map())

function buildLineMap() {
  const map = new Map<number, HTMLElement>()
  if (!previewRef.value) return map
  const children = Array.from(previewRef.value.children) as HTMLElement[]
  let line = 1
  for (const el of children) {
    map.set(line, el)
    line++
  }
  return map
}

function processMermaid(content: string): string {
  const fenceRe = /^```mermaid\n([\s\S]*?)^```$/gm
  let result = content
  let match
  const replacements: { start: number; end: number; html: string }[] = []
  while ((match = fenceRe.exec(content)) !== null) {
    const diagram = match[1].trim()
    const id = 'mermaid-' + Math.random().toString(36).slice(2)
    const html = `<div class="mermaid" id="${id}">${md.utils.escapeHtml(diagram)}</div>`
    replacements.push({ start: match.index, end: match.index + match[0].length, html })
  }
  for (let i = replacements.length - 1; i >= 0; i--) {
    const r = replacements[i]
    result = result.slice(0, r.start) + r.html + result.slice(r.end)
  }
  return result
}

function processWikiLinks(content: string): string {
  return content.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, display) => {
    const text = display || target
    return `<a class="wiki-link" data-filename="${target}">${text}</a>`
  })
}

const renderedContent = computed(() => {
  let processed = processWikiLinks(debouncedContent.value)
  processed = processMermaid(processed)
  return sanitizeMarkdown(md.render(processed))
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

async function renderMermaid() {
  await nextTick()
  if (!previewRef.value) return
  const els = previewRef.value.querySelectorAll<HTMLElement>('.mermaid')
  if (els.length === 0) return
  const mermaid = await getMermaid()
  for (const el of Array.from(els)) {
    const graphDefinition = el.textContent || ''
    try {
      const { svg } = await mermaid.render(
        'mermaid-svg-' + Math.random().toString(36).slice(2),
        graphDefinition
      )
      el.innerHTML = sanitizeSvg(svg)
    } catch {
      el.textContent = 'Mermaid diagram error'
    }
  }
}

function highlightCurrentLine() {
  if (!previewRef.value) return
  previewRef.value.querySelectorAll('.current-line').forEach((el) => {
    el.classList.remove('current-line')
  })
  const el = lineMap.value.get(props.cursorLine)
  if (el) {
    el.classList.add('current-line')
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

let renderTimer: ReturnType<typeof setTimeout> | null = null

watch(debouncedContent, () => {
  if (renderTimer) clearTimeout(renderTimer)
  renderTimer = setTimeout(async () => {
    await renderMermaid()
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
      let line = 1
      for (const [l, el] of lineMap.value.entries()) {
        if (el === heading) {
          line = l
          break
        }
      }
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
  renderMermaid()
  lineMap.value = buildLineMap()
})

onUnmounted(() => {
  if (renderTimer !== null) { clearTimeout(renderTimer); renderTimer = null }
})

const scrollToLine = (line: number) => {
  const container = previewContainer.value
  if (!container) return
  const lineElements = container.querySelectorAll('[data-line]')
  for (const el of lineElements) {
    const elLine = parseInt((el as HTMLElement).dataset.line || '0')
    if (elLine >= line) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      break
    }
  }
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
