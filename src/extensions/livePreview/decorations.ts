import { Decoration, type DecorationSet, WidgetType } from '@codemirror/view'
import type { MarkdownElement } from './types'

class HorizontalRuleWidget extends WidgetType {
  toDOM() {
    const hr = document.createElement('hr')
    hr.className = 'cm-live-preview-hr'
    return hr
  }
}

const hiddenSyntax = Decoration.mark({
  class: 'cm-live-preview-hidden',
  attributes: { style: 'display: none;' }
})

const boldStyle = Decoration.mark({
  class: 'cm-live-preview-bold'
})

const italicStyle = Decoration.mark({
  class: 'cm-live-preview-italic'
})

const strikethroughStyle = Decoration.mark({
  class: 'cm-live-preview-strikethrough'
})

const inlineCodeStyle = Decoration.mark({
  class: 'cm-live-preview-inline-code'
})

const linkStyle = Decoration.mark({
  class: 'cm-live-preview-link'
})

const headingClasses: Record<number, string> = {
  1: 'cm-live-preview-h1',
  2: 'cm-live-preview-h2',
  3: 'cm-live-preview-h3',
  4: 'cm-live-preview-h4',
  5: 'cm-live-preview-h5',
  6: 'cm-live-preview-h6',
}

function getHeadingStyle(level: number) {
  const cls = headingClasses[level]
  return cls ? Decoration.mark({ class: cls }) : null
}

const blockquoteStyle = Decoration.line({
  class: 'cm-live-preview-blockquote'
})

const unorderedListStyle = Decoration.line({
  class: 'cm-live-preview-unordered-list'
})

const orderedListStyle = Decoration.line({
  class: 'cm-live-preview-ordered-list'
})

const taskListStyle = Decoration.line({
  class: 'cm-live-preview-task-list'
})

const horizontalRuleStyle = Decoration.replace({
  widget: new HorizontalRuleWidget(),
  blockReplace: true
})

const codeBlockStyle = Decoration.line({
  class: 'cm-live-preview-code-block'
})

const cursorLineStyle = Decoration.line({
  class: 'cm-live-preview-cursor-line'
})

export function buildDecorations(
  elements: MarkdownElement[],
  cursorLine: number,
  docText: string
): DecorationSet {
  const decorations: { from: number; to: number; decoration: Decoration }[] = []
  const hiddenRanges: { from: number; to: number }[] = []

  // Mark cursor line
  const lines = docText.split('\n')
  let pos = 0
  for (let i = 0; i < lines.length; i++) {
    if (i === cursorLine) {
      decorations.push({
        from: pos,
        to: pos,
        decoration: cursorLineStyle
      })
      break
    }
    pos += lines[i].length + 1
  }

  for (const el of elements) {
    // Skip elements on cursor line
    if (el.line === cursorLine) continue

    switch (el.type) {
      case 'bold': {
        if (el.syntax && el.content) {
          const contentStart = el.from + 2
          const contentEnd = el.to - 2
          hiddenRanges.push({ from: el.from, to: contentStart })
          hiddenRanges.push({ from: contentEnd, to: el.to })
          decorations.push({ from: contentStart, to: contentEnd, decoration: boldStyle })
        }
        break
      }
      case 'italic': {
        if (el.syntax && el.content) {
          const contentStart = el.from + 1
          const contentEnd = el.to - 1
          hiddenRanges.push({ from: el.from, to: contentStart })
          hiddenRanges.push({ from: contentEnd, to: el.to })
          decorations.push({ from: contentStart, to: contentEnd, decoration: italicStyle })
        }
        break
      }
      case 'strikethrough': {
        if (el.syntax && el.content) {
          const contentStart = el.from + 2
          const contentEnd = el.to - 2
          hiddenRanges.push({ from: el.from, to: contentStart })
          hiddenRanges.push({ from: contentEnd, to: el.to })
          decorations.push({ from: contentStart, to: contentEnd, decoration: strikethroughStyle })
        }
        break
      }
      case 'inlineCode': {
        if (el.syntax && el.content) {
          const contentStart = el.from + 1
          const contentEnd = el.to - 1
          hiddenRanges.push({ from: el.from, to: contentStart })
          hiddenRanges.push({ from: contentEnd, to: el.to })
          decorations.push({ from: contentStart, to: contentEnd, decoration: inlineCodeStyle })
        }
        break
      }
      case 'link': {
        if (el.syntax && 'text' in el) {
          const linkEl = el as { text: string; url: string; from: number; to: number; syntax: string }
          const textStart = el.from + 1
          const textEnd = textStart + linkEl.text.length
          const urlStart = textEnd + 2
          hiddenRanges.push({ from: el.from, to: textStart })
          hiddenRanges.push({ from: textEnd, to: el.to })
          decorations.push({ from: textStart, to: textEnd, decoration: linkStyle })
        }
        break
      }
      case 'heading': {
        const headingEl = el as { level: number; syntax: string; from: number; to: number }
        const syntaxEnd = el.from + headingEl.syntax.length + 1
        hiddenRanges.push({ from: el.from, to: syntaxEnd })
        const style = getHeadingStyle(headingEl.level)
        if (style) {
          decorations.push({ from: syntaxEnd, to: el.to, decoration: style })
        }
        break
      }
      case 'blockquote': {
        if (el.syntax) {
          const syntaxEnd = el.from + el.syntax.length + 1
          hiddenRanges.push({ from: el.from, to: syntaxEnd })
        }
        decorations.push({ from: el.from, to: el.from, decoration: blockquoteStyle })
        break
      }
      case 'unorderedList': {
        if (el.syntax) {
          const syntaxEnd = el.from + el.syntax.length
          hiddenRanges.push({ from: el.from, to: syntaxEnd })
        }
        decorations.push({ from: el.from, to: el.from, decoration: unorderedListStyle })
        break
      }
      case 'orderedList': {
        if (el.syntax) {
          const syntaxEnd = el.from + el.syntax.length
          hiddenRanges.push({ from: el.from, to: syntaxEnd })
        }
        decorations.push({ from: el.from, to: el.from, decoration: orderedListStyle })
        break
      }
      case 'taskList': {
        if (el.syntax) {
          const syntaxEnd = el.from + el.syntax.length
          hiddenRanges.push({ from: el.from, to: syntaxEnd })
        }
        decorations.push({ from: el.from, to: el.from, decoration: taskListStyle })
        break
      }
      case 'horizontalRule': {
        decorations.push({ from: el.from, to: el.to, decoration: horizontalRuleStyle })
        break
      }
      case 'codeBlock': {
        decorations.push({ from: el.from, to: el.from, decoration: codeBlockStyle })
        break
      }
    }
  }

  // Merge hidden ranges and add decorations
  const mergedHidden = mergeRanges(hiddenRanges)
  for (const range of mergedHidden) {
    decorations.push({ from: range.from, to: range.to, decoration: hiddenSyntax })
  }

  // Sort by position
  decorations.sort((a, b) => a.from - b.from || a.to - b.to)

  return Decoration.set(decorations.map(d => d.decoration.range(d.from, d.to)))
}

function mergeRanges(ranges: { from: number; to: number }[]): { from: number; to: number }[] {
  if (ranges.length === 0) return []
  const sorted = ranges.slice().sort((a, b) => a.from - b.from)
  const merged: { from: number; to: number }[] = []
  let current = sorted[0]
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].from <= current.to) {
      current.to = Math.max(current.to, sorted[i].to)
    } else {
      merged.push(current)
      current = sorted[i]
    }
  }
  merged.push(current)
  return merged
}
