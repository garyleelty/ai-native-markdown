import { Decoration, type DecorationSet } from '@codemirror/view'
import type { EditorView } from '@codemirror/view'
import { LinkWidget, ImageWidget, HorizontalRuleWidget, CheckboxWidget, TableWidget } from './widgets'

interface DecorationSpec {
  from: number
  to: number
  decoration: Decoration
}

interface Range {
  from: number
  to: number
}

type Align = 'left' | 'center' | 'right'

export function computeDecorations(view: EditorView): DecorationSet {
  const decorations: DecorationSpec[] = []
  const doc = view.state.doc
  const cursorPos = view.state.selection.main.head
  let inCodeBlock = false
  let codeBlockFenceLine = -1

  let pendingTableLines: { line: { from: number; to: number; text: string }; lineText: string }[] = []

  const flushTable = () => {
    if (pendingTableLines.length === 0) return
    processTableBlock(pendingTableLines, decorations)
    pendingTableLines = []
  }

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i)
    const lineText = line.text
    const cursorInThisLine = cursorPos >= line.from && cursorPos <= line.to

    if (cursorInThisLine) {
      flushTable()
      continue
    }

    if (inCodeBlock) {
      flushTable()
      if (/^```\s*$/.test(lineText.trim())) {
        inCodeBlock = false
        processCodeBlockFence(line, lineText, decorations)
      }
      continue
    }

    if (/^```/.test(lineText)) {
      flushTable()
      inCodeBlock = true
      codeBlockFenceLine = i
      processCodeBlockFence(line, lineText, decorations)
      continue
    }

    if (isTableRow(lineText)) {
      pendingTableLines.push({ line, lineText })
    } else {
      flushTable()
      processHeading(line, lineText, decorations)
      processHorizontalRule(line, lineText, decorations)
      processBlockquote(line, lineText, decorations)
      processListItem(line, lineText, decorations)
      processInlineElements(line, lineText, decorations)
    }
  }

  flushTable()

  return Decoration.set(decorations.map(d => d.decoration.range(d.from, d.to)), true)
}

function isTableRow(lineText: string): boolean {
  if (!lineText.includes('|')) return false
  const trimmed = lineText.trim()
  return trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.split('|').length >= 3
}

function parseAlign(separatorCells: string[]): Align[] {
  return separatorCells.map(cell => {
    const trimmed = cell.trim()
    const leftColon = trimmed.startsWith(':')
    const rightColon = trimmed.endsWith(':')
    if (leftColon && rightColon) return 'center'
    if (rightColon) return 'right'
    return 'left'
  })
}

function processTableBlock(
  tableLines: { line: { from: number; to: number; text: string }; lineText: string }[],
  decorations: DecorationSpec[]
) {
  if (tableLines.length < 2) {
    for (const { line, lineText } of tableLines) {
      processInlineElements(line, lineText, decorations)
    }
    return
  }

  const headerLine = tableLines[0].lineText.trim()
  const headerCells = headerLine.split('|').slice(1, -1)

  let separatorIdx = -1
  for (let i = 1; i < tableLines.length; i++) {
    const trimmed = tableLines[i].lineText.trim()
    const cells = trimmed.split('|').slice(1, -1)
    if (cells.every(c => /^\s*:?-+:?\s*$/.test(c.trim()))) {
      separatorIdx = i
      break
    }
  }

  if (separatorIdx === -1) {
    for (const { line, lineText } of tableLines) {
      processInlineElements(line, lineText, decorations)
    }
    return
  }

  const separatorCells = tableLines[separatorIdx].lineText.trim().split('|').slice(1, -1)
  const aligns = parseAlign(separatorCells)

  const dataRows: string[][] = []
  for (let i = separatorIdx + 1; i < tableLines.length; i++) {
    const cells = tableLines[i].lineText.trim().split('|').slice(1, -1)
    dataRows.push(cells)
  }

  const firstLine = tableLines[0].line
  const lastLine = tableLines[tableLines.length - 1].line

  decorations.push({
    from: firstLine.from,
    to: firstLine.from,
    decoration: Decoration.widget({
      widget: new TableWidget(headerCells, dataRows, aligns),
      side: 1
    })
  })

  decorations.push({
    from: firstLine.from,
    to: lastLine.to,
    decoration: Decoration.replace({})
  })
}

function isOverlapping(from: number, to: number, excludedRanges: Range[]): boolean {
  for (const r of excludedRanges) {
    if (from < r.to && to > r.from) return true
  }
  return false
}

function processHeading(
  line: { from: number; to: number; text: string },
  lineText: string,
  decorations: DecorationSpec[]
) {
  const headingMatch = lineText.match(/^(#{1,6})\s/)
  if (!headingMatch) return

  const markFrom = line.from
  const markTo = line.from + headingMatch[1].length
  const level = headingMatch[1].length

  decorations.push({
    from: markFrom,
    to: markTo,
    decoration: Decoration.replace({})
  })

  decorations.push({
    from: line.from,
    to: line.from,
    decoration: Decoration.line({ class: `cm-md-heading-${level}` })
  })
}

function processHorizontalRule(
  line: { from: number; to: number; text: string },
  lineText: string,
  decorations: DecorationSpec[]
) {
  if (/^(---+|\*\*\*+|___+)\s*$/.test(lineText)) {
    decorations.push({
      from: line.from,
      to: line.from,
      decoration: Decoration.widget({
        widget: new HorizontalRuleWidget(),
        side: 1
      })
    })
    decorations.push({
      from: line.from,
      to: line.to,
      decoration: Decoration.replace({})
    })
  }
}

function processBlockquote(
  line: { from: number; to: number; text: string },
  lineText: string,
  decorations: DecorationSpec[]
) {
  const match = lineText.match(/^(>\s?)/)
  if (!match) return

  const markTo = line.from + match[1].length

  decorations.push({
    from: line.from,
    to: markTo,
    decoration: Decoration.replace({})
  })

  decorations.push({
    from: line.from,
    to: line.from,
    decoration: Decoration.line({ class: 'cm-md-blockquote' })
  })
}

function processListItem(
  line: { from: number; to: number; text: string },
  lineText: string,
  decorations: DecorationSpec[]
) {
  const taskMatch = lineText.match(/^(\s*)([-*+])\s\[([ x])\]\s/)
  if (taskMatch) {
    const markTo = line.from + taskMatch[1].length + taskMatch[2].length + 1
    const checkboxEnd = markTo + 3

    decorations.push({
      from: line.from,
      to: markTo,
      decoration: Decoration.replace({})
    })

    decorations.push({
      from: markTo,
      to: checkboxEnd,
      decoration: Decoration.replace({})
    })

    decorations.push({
      from: markTo,
      to: markTo,
      decoration: Decoration.widget({
        widget: new CheckboxWidget(taskMatch[3] === 'x'),
        side: 1
      })
    })

    decorations.push({
      from: line.from,
      to: line.from,
      decoration: Decoration.line({ class: 'cm-md-list-item' })
    })
    return
  }

  const unorderedMatch = lineText.match(/^(\s*)([-*+])\s/)
  if (unorderedMatch) {
    const markTo = line.from + unorderedMatch[1].length + unorderedMatch[2].length + 1
    decorations.push({
      from: line.from,
      to: markTo,
      decoration: Decoration.replace({})
    })
    decorations.push({
      from: line.from,
      to: line.from,
      decoration: Decoration.line({ class: 'cm-md-list-item' })
    })
    return
  }

  const orderedMatch = lineText.match(/^(\s*)(\d+)\.\s/)
  if (orderedMatch) {
    const markTo = line.from + orderedMatch[1].length + orderedMatch[2].length + 2
    decorations.push({
      from: line.from,
      to: markTo,
      decoration: Decoration.replace({})
    })
    decorations.push({
      from: line.from,
      to: line.from,
      decoration: Decoration.line({ class: 'cm-md-list-item' })
    })
  }
}

function processCodeBlockFence(
  line: { from: number; to: number; text: string },
  lineText: string,
  decorations: DecorationSpec[]
) {
  const match = lineText.match(/^(```)\s*(\w*)/)
  if (!match) return

  const markTo = line.from + match[1].length + (match[2] ? match[2].length + 1 : 0)

  decorations.push({
    from: line.from,
    to: markTo,
    decoration: Decoration.replace({})
  })

  decorations.push({
    from: line.from,
    to: line.from,
    decoration: Decoration.line({ class: 'cm-md-code-block-line' })
  })
}

function processInlineElements(
  line: { from: number; to: number; text: string },
  lineText: string,
  decorations: DecorationSpec[]
) {
  const excludedRanges: Range[] = []

  processInlineCode(line, lineText, decorations, excludedRanges)
  processImage(line, lineText, decorations, excludedRanges)
  processLink(line, lineText, decorations, excludedRanges)
  processBold(line, lineText, decorations, excludedRanges)
  processItalic(line, lineText, decorations, excludedRanges)
  processStrikethrough(line, lineText, decorations, excludedRanges)
}

function processBold(
  line: { from: number; to: number; text: string },
  lineText: string,
  decorations: DecorationSpec[],
  excludedRanges: Range[]
) {
  const regex = /\*\*(.+?)\*\*/g
  let match
  while ((match = regex.exec(lineText)) !== null) {
    const start = line.from + match.index
    const end = start + match[0].length
    const contentStart = start + 2
    const contentEnd = end - 2

    if (isOverlapping(start, end, excludedRanges)) continue

    decorations.push({
      from: start,
      to: contentStart,
      decoration: Decoration.replace({})
    })
    decorations.push({
      from: contentEnd,
      to: end,
      decoration: Decoration.replace({})
    })
    decorations.push({
      from: contentStart,
      to: contentEnd,
      decoration: Decoration.mark({ class: 'cm-md-bold' })
    })

    excludedRanges.push({ from: start, to: end })
  }
}

function processItalic(
  line: { from: number; to: number; text: string },
  lineText: string,
  decorations: DecorationSpec[],
  excludedRanges: Range[]
) {
  const regex = /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g
  let match
  while ((match = regex.exec(lineText)) !== null) {
    const start = line.from + match.index
    const end = start + match[0].length
    const contentStart = start + 1
    const contentEnd = end - 1

    if (isOverlapping(start, end, excludedRanges)) continue

    decorations.push({
      from: start,
      to: contentStart,
      decoration: Decoration.replace({})
    })
    decorations.push({
      from: contentEnd,
      to: end,
      decoration: Decoration.replace({})
    })
    decorations.push({
      from: contentStart,
      to: contentEnd,
      decoration: Decoration.mark({ class: 'cm-md-italic' })
    })
  }
}

function processStrikethrough(
  line: { from: number; to: number; text: string },
  lineText: string,
  decorations: DecorationSpec[],
  excludedRanges: Range[]
) {
  const regex = /~~(.+?)~~/g
  let match
  while ((match = regex.exec(lineText)) !== null) {
    const start = line.from + match.index
    const end = start + match[0].length
    const contentStart = start + 2
    const contentEnd = end - 2

    if (isOverlapping(start, end, excludedRanges)) continue

    decorations.push({
      from: start,
      to: contentStart,
      decoration: Decoration.replace({})
    })
    decorations.push({
      from: contentEnd,
      to: end,
      decoration: Decoration.replace({})
    })
    decorations.push({
      from: contentStart,
      to: contentEnd,
      decoration: Decoration.mark({ class: 'cm-md-strikethrough' })
    })
  }
}

function processInlineCode(
  line: { from: number; to: number; text: string },
  lineText: string,
  decorations: DecorationSpec[],
  excludedRanges: Range[]
) {
  const regex = /`([^`]+)`/g
  let match
  while ((match = regex.exec(lineText)) !== null) {
    const start = line.from + match.index
    const end = start + match[0].length
    const contentStart = start + 1
    const contentEnd = end - 1

    decorations.push({
      from: start,
      to: contentStart,
      decoration: Decoration.replace({})
    })
    decorations.push({
      from: contentEnd,
      to: end,
      decoration: Decoration.replace({})
    })
    decorations.push({
      from: contentStart,
      to: contentEnd,
      decoration: Decoration.mark({ class: 'cm-md-inline-code' })
    })

    excludedRanges.push({ from: start, to: end })
  }
}

function processLink(
  line: { from: number; to: number; text: string },
  lineText: string,
  decorations: DecorationSpec[],
  excludedRanges: Range[]
) {
  const regex = /(?<!!)\[([^\]]+)\]\(([^)]+)\)/g
  let match
  while ((match = regex.exec(lineText)) !== null) {
    const start = line.from + match.index
    const end = start + match[0].length

    if (isOverlapping(start, end, excludedRanges)) continue

    decorations.push({
      from: start,
      to: start,
      decoration: Decoration.widget({
        widget: new LinkWidget(match[1], match[2]),
        side: 1
      })
    })

    decorations.push({
      from: start,
      to: end,
      decoration: Decoration.replace({})
    })

    excludedRanges.push({ from: start, to: end })
  }
}

function processImage(
  line: { from: number; to: number; text: string },
  lineText: string,
  decorations: DecorationSpec[],
  excludedRanges: Range[]
) {
  const regex = /!\[([^\]]*)\]\(([^)]+)\)/g
  let match
  while ((match = regex.exec(lineText)) !== null) {
    const start = line.from + match.index
    const end = start + match[0].length

    decorations.push({
      from: start,
      to: start,
      decoration: Decoration.widget({
        widget: new ImageWidget(match[1], match[2]),
        side: 1
      })
    })

    decorations.push({
      from: start,
      to: end,
      decoration: Decoration.replace({})
    })

    excludedRanges.push({ from: start, to: end })
  }
}
