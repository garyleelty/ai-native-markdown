import type { MarkdownElement } from './types'

export function parseMarkdownElements(text: string): MarkdownElement[] {
  const elements: MarkdownElement[] = []

  const lines = text.split('\n')
  let pos = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineStart = pos
    const lineEnd = pos + line.length

    // 代码块
    const codeBlockMatch = line.match(/^(\s*)(```)(.*)$/)
    if (codeBlockMatch) {
      const fence = codeBlockMatch[2]
      const lang = codeBlockMatch[3].trim()
      let endLine = i + 1
      while (endLine < lines.length && !lines[endLine].trim().startsWith(fence)) {
        endLine++
      }
      const blockStart = lineStart
      const blockEnd = endLine < lines.length
        ? pos + line.length + 1 + lines.slice(i + 1, endLine + 1).join('\n').length
        : lineEnd
      elements.push({
        type: 'codeBlock',
        from: blockStart,
        to: blockEnd,
        line: i,
        content: text.slice(blockStart, blockEnd),
        lang
      })
      // Skip lines inside code block for other parsing
      for (let j = i + 1; j <= endLine && j < lines.length; j++) {
        pos += lines[j].length + 1
      }
      i = endLine
      pos = blockEnd + (endLine < lines.length ? 1 : 0)
      continue
    }

    // 标题
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/)
    if (headingMatch) {
      elements.push({
        type: 'heading',
        from: lineStart,
        to: lineEnd,
        line: i,
        level: headingMatch[1].length,
        content: headingMatch[2],
        syntax: headingMatch[1]
      })
    }

    // 引用块
    const blockquoteMatch = line.match(/^(\s*)>\s?(.*)$/)
    if (blockquoteMatch) {
      elements.push({
        type: 'blockquote',
        from: lineStart,
        to: lineEnd,
        line: i,
        content: blockquoteMatch[2],
        syntax: '>'
      })
    }

    // 无序列表
    const ulMatch = line.match(/^(\s*)[-*+]\s+(.*)$/)
    if (ulMatch) {
      elements.push({
        type: 'unorderedList',
        from: lineStart,
        to: lineEnd,
        line: i,
        content: ulMatch[2],
        syntax: ulMatch[1] + ulMatch[0].slice(ulMatch[1].length, ulMatch[1].length + 2)
      })
    }

    // 有序列表
    const olMatch = line.match(/^(\s*)\d+\.\s+(.*)$/)
    if (olMatch) {
      elements.push({
        type: 'orderedList',
        from: lineStart,
        to: lineEnd,
        line: i,
        content: olMatch[2],
        syntax: olMatch[0].slice(0, olMatch[0].length - olMatch[2].length)
      })
    }

    // 任务列表
    const taskMatch = line.match(/^(\s*)[-*+]\s+\[([ xX])\]\s+(.*)$/)
    if (taskMatch) {
      elements.push({
        type: 'taskList',
        from: lineStart,
        to: lineEnd,
        line: i,
        content: taskMatch[3],
        checked: taskMatch[2].toLowerCase() === 'x',
        syntax: taskMatch[0].slice(0, taskMatch[0].length - taskMatch[3].length)
      })
    }

    // 水平线
    if (/^(\s*)(-{3,}|\*{3,}|_{3,})(\s*)$/.test(line)) {
      elements.push({
        type: 'horizontalRule',
        from: lineStart,
        to: lineEnd,
        line: i,
        content: line.trim()
      })
    }

    // 表格行
    if (/^\s*\|.*\|\s*$/.test(line)) {
      elements.push({
        type: 'table',
        from: lineStart,
        to: lineEnd,
        line: i,
        content: line.trim()
      })
    }

    // Wiki 链接 [[note]]
    const wikiLinkRegex = /\[\[([^\]]+)\]\]/g
    let wikiMatch
    while ((wikiMatch = wikiLinkRegex.exec(line)) !== null) {
      elements.push({
        type: 'wikiLink',
        from: lineStart + wikiMatch.index,
        to: lineStart + wikiMatch.index + wikiMatch[0].length,
        line: i,
        content: wikiMatch[1],
        syntax: wikiMatch[0]
      })
    }

    // 行内元素解析 (排除代码块内)
    parseInlineElements(line, lineStart, i, elements)

    pos += line.length + 1
  }

  return elements
}

function parseInlineElements(line: string, lineStart: number, lineIndex: number, elements: MarkdownElement[]) {
  // 图片 ![alt](url)
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
  let imgMatch
  while ((imgMatch = imageRegex.exec(line)) !== null) {
    elements.push({
      type: 'image',
      from: lineStart + imgMatch.index,
      to: lineStart + imgMatch.index + imgMatch[0].length,
      line: lineIndex,
      alt: imgMatch[1],
      url: imgMatch[2],
      syntax: imgMatch[0]
    })
  }

  // 链接 [text](url) - 排除图片
  const linkRegex = /(?<!!)\[([^\]]+)\]\(([^)]+)\)/g
  let linkMatch
  while ((linkMatch = linkRegex.exec(line)) !== null) {
    elements.push({
      type: 'link',
      from: lineStart + linkMatch.index,
      to: lineStart + linkMatch.index + linkMatch[0].length,
      line: lineIndex,
      text: linkMatch[1],
      url: linkMatch[2],
      syntax: linkMatch[0]
    })
  }

  // 粗体 **text**
  const boldRegex = /\*\*([^*]+)\*\*/g
  let boldMatch
  while ((boldMatch = boldRegex.exec(line)) !== null) {
    elements.push({
      type: 'bold',
      from: lineStart + boldMatch.index,
      to: lineStart + boldMatch.index + boldMatch[0].length,
      line: lineIndex,
      content: boldMatch[1],
      syntax: boldMatch[0]
    })
  }

  // 斜体 *text* (排除粗体)
  const italicRegex = /(?<!\*)\*([^*]+)\*(?!\*)/g
  let italicMatch
  while ((italicMatch = italicRegex.exec(line)) !== null) {
    elements.push({
      type: 'italic',
      from: lineStart + italicMatch.index,
      to: lineStart + italicMatch.index + italicMatch[0].length,
      line: lineIndex,
      content: italicMatch[1],
      syntax: italicMatch[0]
    })
  }

  // 删除线 ~~text~~
  const strikethroughRegex = /~~([^~]+)~~/g
  let strikeMatch
  while ((strikeMatch = strikethroughRegex.exec(line)) !== null) {
    elements.push({
      type: 'strikethrough',
      from: lineStart + strikeMatch.index,
      to: lineStart + strikeMatch.index + strikeMatch[0].length,
      line: lineIndex,
      content: strikeMatch[1],
      syntax: strikeMatch[0]
    })
  }

  // 行内代码 `code`
  const codeRegex = /`([^`]+)`/g
  let codeMatch
  while ((codeMatch = codeRegex.exec(line)) !== null) {
    elements.push({
      type: 'inlineCode',
      from: lineStart + codeMatch.index,
      to: lineStart + codeMatch.index + codeMatch[0].length,
      line: lineIndex,
      content: codeMatch[1],
      syntax: codeMatch[0]
    })
  }

  // KaTeX 行内公式 $...$
  const katexInlineRegex = /\$([^$\n]+)\$/g
  let katexInlineMatch
  while ((katexInlineMatch = katexInlineRegex.exec(line)) !== null) {
    elements.push({
      type: 'katexInline',
      from: lineStart + katexInlineMatch.index,
      to: lineStart + katexInlineMatch.index + katexInlineMatch[0].length,
      line: lineIndex,
      content: katexInlineMatch[1],
      syntax: katexInlineMatch[0]
    })
  }

  // KaTeX 块级公式 $$...$$
  const katexBlockRegex = /\$\$([^$]+)\$\$/g
  let katexBlockMatch
  while ((katexBlockMatch = katexBlockRegex.exec(line)) !== null) {
    elements.push({
      type: 'katexBlock',
      from: lineStart + katexBlockMatch.index,
      to: lineStart + katexBlockMatch.index + katexBlockMatch[0].length,
      line: lineIndex,
      content: katexBlockMatch[1],
      syntax: katexBlockMatch[0]
    })
  }
}
