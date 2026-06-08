import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, WidgetType } from '@codemirror/view'
import type { Extension, Range } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import { EmbedWidget } from '@/extensions/embed/embedWidget'
import { embedSyncService } from '@/services/embedSyncService'

export interface LivePreviewOptions {
  currentFile?: () => string
  onEmbedNavigate?: (target: string) => void
  dependencyOwnerId?: () => string
  embedRefreshKey?: () => number
}

class HeaderMarkWidget extends WidgetType {
  constructor(readonly level: number, readonly text: string) { super() }
  toDOM(): HTMLElement {
    const span = document.createElement('span')
    span.className = `cm-live-preview-header cm-header-${this.level}`
    span.textContent = this.text
    return span
  }
  ignoreEvent(): boolean { return false }
  eq(other: HeaderMarkWidget): boolean {
    return this.level === other.level && this.text === other.text
  }
}

class CheckboxWidget extends WidgetType {
  constructor(readonly checked: boolean, readonly from: number, readonly to: number) { super() }
  toDOM(view: EditorView): HTMLElement {
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.checked = this.checked
    input.className = 'cm-live-preview-checkbox'
    input.setAttribute('aria-label', this.checked ? '标记任务为已完成' : '标记任务为未完成')
    input.dataset.from = String(this.from)
    input.dataset.to = String(this.to)
    input.addEventListener('mousedown', (event) => {
      event.preventDefault()
      event.stopPropagation()
      const currentMarker = view.state.sliceDoc(this.from, this.to)
      const nextChecked = !/^\[[xX]\]$/.test(currentMarker)
      input.checked = nextChecked
      view.dispatch({
        changes: { from: this.from, to: this.to, insert: nextChecked ? '[x]' : '[ ]' },
        selection: { anchor: this.to },
      })
      view.focus()
    })
    input.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
    })
    return input
  }
  ignoreEvent(): boolean { return true }
  eq(other: CheckboxWidget): boolean {
    return this.checked === other.checked && this.from === other.from && this.to === other.to
  }
}

class ImageWidget extends WidgetType {
  constructor(readonly alt: string, readonly url: string) { super() }
  toDOM(): HTMLElement {
    const container = document.createElement('span')
    container.className = 'cm-live-preview-image'
    const img = document.createElement('img')
    img.src = this.url
    img.alt = this.alt
    img.style.maxWidth = '100%'
    img.style.borderRadius = '4px'
    container.appendChild(img)
    return container
  }
  ignoreEvent(): boolean { return false }
  eq(other: ImageWidget): boolean { return this.url === other.url && this.alt === other.alt }
}

class HrWidget extends WidgetType {
  toDOM(): HTMLElement {
    const hr = document.createElement('hr')
    hr.className = 'cm-live-preview-hr'
    return hr
  }
  ignoreEvent(): boolean { return false }
}

function parseEmbedLine(text: string): { target: string; heading?: string } | null {
  const match = text.match(/^\s*!\[\[([^\]\n]+)\]\]\s*$/)
  if (!match) return null
  const raw = match[1].trim()
  const hashIndex = raw.indexOf('#')
  const target = (hashIndex === -1 ? raw : raw.slice(0, hashIndex)).trim()
  const heading = hashIndex === -1 ? '' : raw.slice(hashIndex + 1).trim()
  if (!target && !heading) return null
  return { target, heading: heading || undefined }
}

function buildDecorations(view: EditorView, options: LivePreviewOptions = {}, renderEpoch = 0): DecorationSet {
  const decorations: Range<Decoration>[] = []
  const doc = view.state.doc
  const hostPath = options.currentFile?.()
  const dependencyOwnerId = hostPath ? options.dependencyOwnerId?.() : undefined
  const widgetRenderKey = `${renderEpoch}:${options.embedRefreshKey?.() ?? 0}`

  // 获取当前光标所在行
  const cursorLine = doc.lineAt(view.state.selection.main.head).number

  if (hostPath && dependencyOwnerId) {
    embedSyncService.replaceOwnerDependencies(dependencyOwnerId, hostPath, [])
  }

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i)
    const text = line.text
    const embed = parseEmbedLine(text)

    if (embed) {
      decorations.push(
        Decoration.replace({
          widget: new EmbedWidget(embed.target, embed.heading, widgetRenderKey, {
            currentFile: options.currentFile,
            currentContent: () => view.state.doc.toString(),
            onNavigate: options.onEmbedNavigate,
            onDependencies: (dependencies) => {
              if (hostPath && dependencyOwnerId) {
                embedSyncService.addOwnerDependencies(dependencyOwnerId, hostPath, dependencies)
              }
            },
          }),
        }).range(line.from, line.to)
      )
      continue
    }

    const headingMatch = text.match(/^(#{1,6})\s+(.+)/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const content = headingMatch[2]
      const markEnd = line.from + headingMatch[1].length + 1

      // 如果光标在当前标题行，只隐藏 # 标记，保留内容可编辑
      if (i === cursorLine) {
        decorations.push(
          Decoration.replace({}).range(line.from, markEnd),
        )
      } else {
        decorations.push(
          Decoration.replace({ widget: new HeaderMarkWidget(level, content) }).range(line.from, markEnd),
          Decoration.replace({}).range(markEnd, line.to),
        )
      }
      continue
    }

    if (text.match(/^---+\s*$/)) {
      decorations.push(Decoration.replace({ widget: new HrWidget() }).range(line.from, line.to))
      continue
    }

    const checkboxMatch = text.match(/^(\s*[-*+]\s+)\[([ xX])\]\s*/)
    if (checkboxMatch) {
      const checked = checkboxMatch[2] !== ' '
      const bracketStart = line.from + checkboxMatch[1].length
      const bracketEnd = bracketStart + 3
      decorations.push(
        Decoration.replace({ widget: new CheckboxWidget(checked, bracketStart, bracketEnd) })
          .range(bracketStart, bracketEnd)
      )
    }

    const imageMatch = text.match(/!\[([^\]]*)\]\(([^)]+)\)/)
    if (imageMatch && !text.match(/^!/)) {
      const idx = text.indexOf('![')
      if (idx >= 0) {
        const start = line.from + idx
        const end = start + imageMatch[0].length
        decorations.push(Decoration.replace({ widget: new ImageWidget(imageMatch[1], imageMatch[2]) }).range(start, end))
      }
    }
  }

  const boldDeco = Decoration.mark({ class: 'cm-live-preview-bold' })
  const italicDeco = Decoration.mark({ class: 'cm-live-preview-italic' })
  const strikethroughDeco = Decoration.mark({ class: 'cm-live-preview-strikethrough' })
  const codeDeco = Decoration.mark({ class: 'cm-live-preview-code' })
  const linkDeco = Decoration.mark({ class: 'cm-live-preview-link' })

  syntaxTree(view.state).iterate({
    enter(node) {
      const from = node.from
      const to = node.to

      if (node.name === 'Emphasis') {
        decorations.push(italicDeco.range(from, to))
      } else if (node.name === 'StrongEmphasis') {
        decorations.push(boldDeco.range(from, to))
      } else if (node.name === 'Strikethrough') {
        decorations.push(strikethroughDeco.range(from, to))
      } else if (node.name === 'InlineCode') {
        decorations.push(codeDeco.range(from, to))
      } else if (node.name === 'Link') {
        decorations.push(linkDeco.range(from, to))
      }
    }
  })

  return Decoration.set(decorations, true)
}

export function createLivePreviewPlugin(options: LivePreviewOptions = {}): Extension {
  return ViewPlugin.fromClass(class {
    decorations: DecorationSet
    renderEpoch = 0

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view, options, this.renderEpoch)
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        if (update.docChanged) this.renderEpoch += 1
        this.decorations = buildDecorations(update.view, options, this.renderEpoch)
      }
    }
  }, {
    decorations: v => v.decorations
  })
}

export const livePreviewPlugin = createLivePreviewPlugin()
