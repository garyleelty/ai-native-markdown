const MARKDOWN_EXTENSIONS = ['.md', '.markdown']
const WORKSPACE_ROOT = '/workspace'

export interface ParsedWikiLinkTarget {
  fileTarget: string
  heading: string
}

export interface MarkdownHeading {
  level: number
  text: string
  slug: string
  lineNumber: number
}

export interface MarkdownBlock {
  id: string
  text: string
  lineNumber: number
}

export interface LinkUnlinkedMentionOptions {
  lineNumber?: number
}

export interface RenameWikiLinksOptions {
  sourcePath: string
  sourcePathBeforeRename?: string
  oldPath: string
  newPath: string
  markdownPathsBeforeRename: string[]
  isDirectory?: boolean
}

export function parseWikiLinkTarget(rawTarget: string): ParsedWikiLinkTarget {
  const target = rawTarget
    .split('|')[0]
    .trim()
    .replace(/\\/g, '/')
  const headingIndex = target.indexOf('#')
  if (headingIndex === -1) {
    return { fileTarget: target, heading: '' }
  }
  return {
    fileTarget: target.slice(0, headingIndex).trim(),
    heading: target.slice(headingIndex + 1).trim(),
  }
}

function hasMarkdownExtension(path: string): boolean {
  return MARKDOWN_EXTENSIONS.some(ext => path.toLowerCase().endsWith(ext))
}

function withMarkdownExtensions(path: string): string[] {
  return hasMarkdownExtension(path) ? [path] : [path, ...MARKDOWN_EXTENSIONS.map(ext => `${path}${ext}`)]
}

function dirname(path: string): string {
  const normalized = path.replace(/\/+$/g, '')
  const index = normalized.lastIndexOf('/')
  return index > 0 ? normalized.slice(0, index) : WORKSPACE_ROOT
}

function normalizeWorkspacePath(path: string): string {
  const parts: string[] = []
  for (const part of path.replace(/\\/g, '/').split('/')) {
    if (!part || part === '.') continue
    if (part === '..') {
      parts.pop()
      continue
    }
    parts.push(part)
  }

  if (parts[0] === 'workspace') {
    return `/${parts.join('/')}`
  }
  return `${WORKSPACE_ROOT}/${parts.join('/')}`
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items))
}

function fileNameWithoutMarkdownExtension(path: string): string {
  return path
    .split('/')
    .pop()
    ?.replace(/\.(md|markdown)$/i, '') || ''
}

function stripMarkdownExtension(path: string): string {
  return path.replace(/\.(md|markdown)$/i, '')
}

function workspaceRelativePath(path: string): string {
  return path.replace(/^\/workspace\/?/, '')
}

function relativePath(fromDir: string, targetPath: string): string {
  const fromParts = workspaceRelativePath(fromDir).split('/').filter(Boolean)
  const targetParts = workspaceRelativePath(targetPath).split('/').filter(Boolean)

  while (fromParts.length > 0 && targetParts.length > 0 && fromParts[0] === targetParts[0]) {
    fromParts.shift()
    targetParts.shift()
  }

  const prefix = fromParts.map(() => '..')
  const relative = [...prefix, ...targetParts].join('/')
  return relative || fileNameWithoutMarkdownExtension(targetPath)
}

function decodeHeading(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function normalizeHeadingText(value: string): string {
  return decodeHeading(value)
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

function normalizeHeadingSlug(value: string): string {
  return normalizeHeadingText(value)
    .replace(/[^\w\u3400-\u9fff\s-]/g, '')
    .replace(/\s+/g, '-')
}

function cleanHeadingText(lineText: string): string {
  return lineText.replace(/\s+#+\s*$/g, '').trim()
}

function parseFenceMarker(line: string): { marker: '`' | '~'; length: number } | null {
  const match = line.match(/^ {0,3}(`{3,}|~{3,})/)
  if (!match) return null
  const sequence = match[1]
  return {
    marker: sequence[0] as '`' | '~',
    length: sequence.length,
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function getWikiLinkRanges(line: string): Array<{ start: number; end: number }> {
  return Array.from(line.matchAll(/\[\[[^\]]+\]\]/g)).map(match => ({
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
  }))
}

function isInsideRanges(start: number, end: number, ranges: Array<{ start: number; end: number }>): boolean {
  return ranges.some(range => start >= range.start && end <= range.end)
}

function findMentionInLine(line: string, names: string[]): { start: number; end: number } | null {
  const ranges = getWikiLinkRanges(line)
  const orderedNames = [...new Set(names.map(name => name.trim()).filter(Boolean))]
    .sort((a, b) => b.length - a.length)

  for (const name of orderedNames) {
    if (/^[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]+$/.test(name)) {
      if (name.length < 3) continue
      let index = line.indexOf(name)
      while (index !== -1) {
        const end = index + name.length
        if (!isInsideRanges(index, end, ranges)) return { start: index, end }
        index = line.indexOf(name, end)
      }
      continue
    }

    if (name.length < 3) continue
    const re = new RegExp(`(^|[^\\p{L}\\p{N}_-])(${escapeRegExp(name)})(?=$|[^\\p{L}\\p{N}_-])`, 'iu')
    const match = line.match(re)
    if (!match || match.index === undefined) continue
    const start = match.index + match[1].length
    const end = start + match[2].length
    if (!isInsideRanges(start, end, ranges)) return { start, end }
  }

  return null
}

function getBlockIdMatch(line: string): RegExpMatchArray | null {
  return line.match(/(?:^|\s)\^([A-Za-z0-9_-]+)\s*$/)
}

function removeBlockIdMarker(line: string, id: string): string {
  return line.replace(new RegExp(`\\s*\\^${escapeRegExp(id)}\\s*$`), '').trimEnd()
}

function isParagraphBoundary(line: string): boolean {
  return !line.trim() || /^ {0,3}#{1,6}\s+/.test(line)
}

function blockStartLine(lines: string[], markerLineIndex: number): number {
  const markerLine = lines[markerLineIndex]
  if (/^ {0,3}(#{1,6})\s+/.test(markerLine)) return markerLineIndex
  if (/^\s*(?:[-+*]|\d+[.)])\s+/.test(markerLine)) return markerLineIndex
  if (/^\s*>/.test(markerLine)) return markerLineIndex

  let start = markerLineIndex
  while (start > 0 && !isParagraphBoundary(lines[start - 1])) {
    start -= 1
  }
  return start
}

function getRenamedResolvedPath(resolvedPath: string, oldPath: string, newPath: string, isDirectory = false): string | null {
  if (resolvedPath === oldPath) return newPath
  if (isDirectory && resolvedPath.startsWith(`${oldPath}/`)) {
    return `${newPath}${resolvedPath.slice(oldPath.length)}`
  }
  return null
}

function formatRenamedTarget(originalTarget: string, sourcePath: string, renamedPath: string): string {
  const keepExtension = hasMarkdownExtension(originalTarget)
  const targetPath = keepExtension ? renamedPath : stripMarkdownExtension(renamedPath)

  if (originalTarget.startsWith('/')) {
    return `/${workspaceRelativePath(targetPath)}`
  }

  if (originalTarget.startsWith('./') || originalTarget.startsWith('../')) {
    const relative = relativePath(dirname(sourcePath), targetPath)
    if (originalTarget.startsWith('./') && !relative.startsWith('../') && !relative.startsWith('./')) {
      return `./${relative}`
    }
    return relative
  }

  if (originalTarget.includes('/')) {
    return workspaceRelativePath(targetPath)
  }

  return keepExtension
    ? renamedPath.split('/').pop() || originalTarget
    : fileNameWithoutMarkdownExtension(renamedPath)
}

export function updateWikiLinksForRename(content: string, options: RenameWikiLinksOptions): string {
  return content.replace(/\[\[([^\]]+)\]\]/g, (fullMatch, inner: string) => {
    const pipeIndex = inner.indexOf('|')
    const targetPart = pipeIndex === -1 ? inner : inner.slice(0, pipeIndex)
    const aliasPart = pipeIndex === -1 ? '' : inner.slice(pipeIndex + 1).trim()
    const parsed = parseWikiLinkTarget(targetPart)
    if (!parsed.fileTarget) return fullMatch

    const resolvedPath = resolveWikiLinkTarget(
      targetPart,
      options.sourcePathBeforeRename || options.sourcePath,
      options.markdownPathsBeforeRename
    )
    if (!resolvedPath) return fullMatch

    const renamedPath = getRenamedResolvedPath(
      resolvedPath,
      options.oldPath,
      options.newPath,
      options.isDirectory
    )
    if (!renamedPath) return fullMatch

    const renamedTarget = formatRenamedTarget(parsed.fileTarget, options.sourcePath, renamedPath)
    const nextTarget = `${renamedTarget}${parsed.heading ? `#${parsed.heading}` : ''}`
    return `[[${nextTarget}${aliasPart ? `|${aliasPart}` : ''}]]`
  })
}

export function linkFirstUnlinkedMention(
  content: string,
  names: string[],
  targetTitle: string,
  options: LinkUnlinkedMentionOptions = {}
): string | null {
  const title = targetTitle.trim()
  if (!title) return null

  const lines = content.split('\n')
  const preferredIndex = options.lineNumber ? options.lineNumber - 1 : -1
  const lineIndexes = [
    ...(preferredIndex >= 0 && preferredIndex < lines.length ? [preferredIndex] : []),
    ...lines.map((_, index) => index).filter(index => index !== preferredIndex),
  ]

  for (const index of lineIndexes) {
    const match = findMentionInLine(lines[index], names)
    if (!match) continue
    const line = lines[index]
    lines[index] = `${line.slice(0, match.start)}[[${title}]]${line.slice(match.end)}`
    return lines.join('\n')
  }

  return null
}

export function extractMarkdownHeadings(content: string): MarkdownHeading[] {
  const lines = content.split('\n')
  const headings: MarkdownHeading[] = []
  let activeFence: { marker: '`' | '~'; length: number } | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const fence = parseFenceMarker(line)

    if (activeFence) {
      if (
        fence &&
        fence.marker === activeFence.marker &&
        fence.length >= activeFence.length
      ) {
        activeFence = null
      }
      continue
    }

    if (fence) {
      activeFence = fence
      continue
    }

    const match = line.match(/^ {0,3}(#{1,6})\s+(.+)$/)
    if (!match) continue

    const text = cleanHeadingText(match[2])
    if (!text) continue

    headings.push({
      level: match[1].length,
      text,
      slug: normalizeHeadingSlug(text),
      lineNumber: i + 1,
    })
  }

  return headings
}

export function extractMarkdownBlocks(content: string): MarkdownBlock[] {
  const lines = content.split('\n')
  const blocks: MarkdownBlock[] = []
  let activeFence: { marker: '`' | '~'; length: number } | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const fence = parseFenceMarker(line)

    if (activeFence) {
      if (
        fence &&
        fence.marker === activeFence.marker &&
        fence.length >= activeFence.length
      ) {
        activeFence = null
      }
      continue
    }

    if (fence) {
      activeFence = fence
      continue
    }

    const match = getBlockIdMatch(line)
    if (!match) continue
    const id = match[1]
    const start = blockStartLine(lines, i)
    const blockLines = lines.slice(start, i + 1)
    blockLines[blockLines.length - 1] = removeBlockIdMarker(blockLines[blockLines.length - 1], id)
    const text = blockLines.join('\n').trim()
    if (!text) continue
    blocks.push({ id, text, lineNumber: start + 1 })
  }

  return blocks
}

export function findMarkdownHeadingLine(content: string, heading: string): number | null {
  const targetText = normalizeHeadingText(heading)
  const targetSlug = normalizeHeadingSlug(heading)
  if (!targetText) return null

  for (const headingItem of extractMarkdownHeadings(content)) {
    if (
      normalizeHeadingText(headingItem.text) === targetText ||
      headingItem.slug === targetSlug
    ) {
      return headingItem.lineNumber
    }
  }
  return null
}

export function findMarkdownBlockLine(content: string, blockId: string): number | null {
  const normalizedId = blockId.replace(/^\^/, '').trim()
  if (!normalizedId) return null
  const block = extractMarkdownBlocks(content).find(item => item.id === normalizedId)
  return block?.lineNumber ?? null
}

export function resolveWikiLinkTarget(rawTarget: string, currentFile: string, markdownPaths: string[]): string | null {
  const { fileTarget: target } = parseWikiLinkTarget(rawTarget)
  if (!target) return currentFile || null

  const exactPaths = new Set(markdownPaths)
  const lowerPathMap = new Map(markdownPaths.map(path => [path.toLowerCase(), path]))
  const currentDir = currentFile ? dirname(currentFile) : WORKSPACE_ROOT
  const baseCandidates: string[] = []

  if (target.startsWith('/')) {
    baseCandidates.push(normalizeWorkspacePath(target))
  } else {
    if (target.startsWith('./') || target.startsWith('../')) {
      baseCandidates.push(normalizeWorkspacePath(`${currentDir}/${target}`))
    }
    baseCandidates.push(normalizeWorkspacePath(`${currentDir}/${target}`))
    baseCandidates.push(normalizeWorkspacePath(`${WORKSPACE_ROOT}/${target}`))
  }

  for (const candidate of unique(baseCandidates.flatMap(withMarkdownExtensions))) {
    if (exactPaths.has(candidate)) return candidate
    const caseInsensitiveMatch = lowerPathMap.get(candidate.toLowerCase())
    if (caseInsensitiveMatch) return caseInsensitiveMatch
  }

  const normalizedTargetName = fileNameWithoutMarkdownExtension(target).toLowerCase()
  if (!target.includes('/') && normalizedTargetName) {
    const basenameMatches = markdownPaths.filter(path => {
      const fileName = path.split('/').pop()?.toLowerCase() || ''
      return fileName === target.toLowerCase() || fileNameWithoutMarkdownExtension(path).toLowerCase() === normalizedTargetName
    })
    if (basenameMatches.length === 1) return basenameMatches[0]
  }

  return null
}

export function getCreatableWikiLinkPath(rawTarget: string, currentFile: string): string | null {
  const { fileTarget: target } = parseWikiLinkTarget(rawTarget)
  if (!target) return null

  const currentDir = currentFile ? dirname(currentFile) : WORKSPACE_ROOT
  const basePath = target.startsWith('/')
    ? normalizeWorkspacePath(target)
    : normalizeWorkspacePath(`${currentDir}/${target}`)

  return hasMarkdownExtension(basePath) ? basePath : `${basePath}.md`
}

export function createWikiLinkInitialContent(rawTarget: string): string {
  const { fileTarget: target } = parseWikiLinkTarget(rawTarget)
  const title = fileNameWithoutMarkdownExtension(target).trim() || 'Untitled'
  return `# ${decodeHeading(title)}\n`
}
