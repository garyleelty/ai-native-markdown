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
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import taskLists from 'markdown-it-task-lists'
import anchor from 'markdown-it-anchor'
import katex from 'markdown-it-katex'
import mermaid from 'mermaid'

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

const md: MarkdownIt = new MarkdownIt({
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
  return content.replace(/\[\[([^\]]+)\]\]/g, '<a class="wiki-link" data-filename="$1">$1</a>')
}

const renderedContent = computed(() => {
  let processed = processWikiLinks(props.content)
  processed = processMermaid(processed)
  return md.render(processed)
})

async function renderMermaid() {
  await nextTick()
  if (!previewRef.value) return
  const els = previewRef.value.querySelectorAll<HTMLElement>('.mermaid')
  for (const el of Array.from(els)) {
    const graphDefinition = el.textContent || ''
    try {
      const { svg } = await mermaid.render(
        'mermaid-svg-' + Math.random().toString(36).slice(2),
        graphDefinition
      )
      el.innerHTML = svg
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

watch(() => props.content, async () => {
  await renderMermaid()
  lineMap.value = buildLineMap()
  highlightCurrentLine()
})

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
  mermaid.initialize({ startOnLoad: false, theme: 'default' })
  renderMermaid()
  lineMap.value = buildLineMap()
})
</script>

<style scoped>
.preview-container {
  height: 100%;
  overflow: hidden;
  background: var(--bg-base);
}

.preview-content {
  height: 100%;
  overflow-y: auto;
  padding: var(--space-8) var(--space-10);
  max-width: 820px;
  margin: 0 auto;
}

.markdown-body {
  color: var(--text-primary);
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
  color: var(--text-primary);
  letter-spacing: -0.03em;
  position: relative;
}

.markdown-body h1 {
  font-size: 20px;
  padding-bottom: 0.35em;
}
.markdown-body h1::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: 0;
  width: 60px;
  height: 3px;
  background: linear-gradient(90deg, var(--accent-primary), transparent);
  border-radius: 2px;
}

.markdown-body h2 {
  font-size: 16px;
  padding-bottom: 0.3em;
  border-bottom: 1px solid var(--border-subtle);
}

.markdown-body h3 {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
}
.markdown-body h4 {
  font-size: 1.08em;
  color: var(--text-secondary);
}

.markdown-body h1:first-child, .markdown-body h2:first-child,
.markdown-body h3:first-child {
  margin-top: 0;
}

.markdown-body .header-anchor {
  color: var(--text-muted);
  text-decoration: none;
  margin-right: 0.4em;
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-default);
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
  text-align: justify;
}

.markdown-body strong {
  color: var(--accent-primary);
  font-weight: 650;
}

.markdown-body em {
  color: var(--text-secondary);
  font-style: italic;
}

.markdown-body a {
  color: var(--accent-primary);
  text-decoration: none;
  position: relative;
  transition: all var(--duration-fast) var(--ease-default);
}
.markdown-body a::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  width: 0;
  height: 1.5px;
  background: linear-gradient(90deg, var(--accent-primary), var(--accent-mauve));
  transition: width var(--duration-slow) var(--ease-default);
  border-radius: 1px;
}
.markdown-body a:hover::after {
  width: 100%;
}
.markdown-body a:hover {
  text-shadow: 0 0 10px var(--accent-soft);
}

.markdown-body .wiki-link {
  color: var(--accent-teal);
  cursor: pointer;
}
.markdown-body .wiki-link::after {
  background: linear-gradient(90deg, var(--accent-teal), var(--accent-green));
}

.markdown-body code {
  background: var(--bg-surface);
  color: var(--accent-primary);
  padding: 2.5px 7px;
  border-radius: 5px;
  font-family: var(--font-mono);
  font-size: 0.87em;
  font-weight: 500;
  border: 1px solid var(--border-subtle);
  box-shadow: inset 0 1px 2px rgba(0,0,0,0.04);
}

.markdown-body pre {
  background: var(--bg-elevated);
  padding: 18px 22px;
  border-radius: var(--radius-md);
  overflow-x: auto;
  margin: 1.4em 0;
  border: 1px solid var(--border-subtle);
  position: relative;
}
.markdown-body pre::before {
  content: '';
  position: absolute;
  top: 12px;
  left: 16px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ff5f56;
  box-shadow: 14px 0 0 #ffbd2e, 28px 0 0 #27ca40;
}
.markdown-body pre code {
  background: none;
  color: var(--text-primary);
  padding: 0;
  font-size: 0.86em;
  line-height: 1.65;
  border: none;
  box-shadow: none;
  display: block;
  padding-top: 8px;
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
  color: var(--accent-primary);
  font-weight: 600;
}

.markdown-body .task-list-item {
  list-style-type: none;
  padding-left: 0;
}
.markdown-body .task-list-item input[type="checkbox"] {
  accent-color: var(--accent-primary);
  width: 16px;
  height: 16px;
  cursor: pointer;
  margin-right: 8px;
  vertical-align: middle;
}

.markdown-body blockquote {
  border-left: 3px solid var(--accent-primary);
  padding: 0.6em 1.2em;
  margin: 1.3em 0;
  color: var(--text-secondary);
  background: var(--accent-soft);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}
.markdown-body blockquote p:last-child {
  margin-bottom: 0;
}

.markdown-body hr {
  border: none;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--border-subtle), transparent);
  margin: 2.5em 0;
  position: relative;
}
.markdown-body hr::after {
  content: '·';
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  color: var(--text-muted);
  font-size: 1.2em;
  background: var(--bg-base);
  padding: 0 12px;
}

.markdown-body table {
  border-collapse: separate;
  border-spacing: 0;
  width: 100%;
  margin: 1.3em 0;
  font-size: 0.93em;
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: 1px solid var(--border-subtle);
}
.markdown-body th, .markdown-body td {
  border: none;
  border-bottom: 1px solid var(--border-subtle);
  border-right: 1px solid var(--border-subtle);
  padding: 10px 14px;
  text-align: left;
}
.markdown-body th:last-child, .markdown-body td:last-child {
  border-right: none;
}
.markdown-body th {
  background: var(--bg-elevated);
  font-weight: 600;
  color: var(--text-primary);
  font-size: 0.85em;
  letter-spacing: 0.02em;
}
.markdown-body tr:last-child td {
  border-bottom: none;
}
.markdown-body tr:nth-child(even) td {
  background: var(--bg-hover);
}
.markdown-body tr:hover td {
  background: var(--bg-active);
}

.markdown-body img {
  max-width: 100%;
  border-radius: var(--radius-lg);
  margin: 1.3em 0;
  box-shadow: var(--shadow-md);
  transition: transform var(--duration-slow) var(--ease-default), box-shadow var(--duration-slow) var(--ease-default);
}
.markdown-body img:hover {
  transform: scale(1.01);
  box-shadow: var(--shadow-lg);
}

.markdown-body .mermaid {
  background: var(--bg-deep);
  padding: 18px 22px;
  border-radius: var(--radius-md);
  margin: 1.4em 0;
  border: 1px solid var(--border-subtle);
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
  color: var(--text-primary) !important;
}

.current-line {
  background: var(--accent-soft-hover);
  border-radius: var(--radius-sm);
  transition: background var(--duration-fast) var(--ease-default);
}
</style>
