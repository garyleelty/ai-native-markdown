import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, WidgetType } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'

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
  constructor(readonly checked: boolean) { super() }
  toDOM(): HTMLElement {
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.checked = this.checked
    input.className = 'cm-live-preview-checkbox'
    input.setAttribute('aria-label', this.checked ? 'checked' : 'unchecked')
    return input
  }
  ignoreEvent(): boolean { return false }
  eq(other: CheckboxWidget): boolean { return this.checked === other.checked }
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

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const doc = view.state.doc

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i)
    const text = line.text

    const headingMatch = text.match(/^(#{1,6})\s+(.+)/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const content = headingMatch[2]
      const markEnd = line.from + headingMatch[1].length + 1

      builder.add(
        line.from,
        markEnd,
        Decoration.replace({ widget: new HeaderMarkWidget(level, content) })
      )
      builder.add(
        markEnd,
        line.to,
        Decoration.replace({})
      )
      continue
    }

    if (text.match(/^---+\s*$/)) {
      builder.add(line.from, line.to, Decoration.replace({ widget: new HrWidget() }))
      continue
    }

    const checkboxMatch = text.match(/^(\s*[-*+]\s+)\[([ xX])\]\s*/)
    if (checkboxMatch) {
      const checked = checkboxMatch[2] !== ' '
      const bracketStart = line.from + checkboxMatch[1].length
      const bracketEnd = bracketStart + 3
      builder.add(
        bracketStart,
        bracketEnd,
        Decoration.replace({ widget: new CheckboxWidget(checked) })
      )
    }

    const imageMatch = text.match(/!\[([^\]]*)\]\(([^)]+)\)/)
    if (imageMatch && !text.match(/^!/)) {
      const idx = text.indexOf('![')
      if (idx >= 0) {
        const start = line.from + idx
        const end = start + imageMatch[0].length
        builder.add(start, end, Decoration.replace({ widget: new ImageWidget(imageMatch[1], imageMatch[2]) }))
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
        builder.add(from, to, italicDeco)
      } else if (node.name === 'StrongEmphasis') {
        builder.add(from, to, boldDeco)
      } else if (node.name === 'Strikethrough') {
        builder.add(from, to, strikethroughDeco)
      } else if (node.name === 'InlineCode') {
        builder.add(from, to, codeDeco)
      } else if (node.name === 'Link') {
        builder.add(from, to, linkDeco)
      }
    }
  })

  return builder.finish()
}

export const livePreviewPlugin = ViewPlugin.fromClass(class {
  decorations: DecorationSet

  constructor(view: EditorView) {
    this.decorations = buildDecorations(view)
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.viewportChanged) {
      this.decorations = buildDecorations(update.view)
    }
  }
}, {
  decorations: v => v.decorations
})
