import { vaultService } from '@/services/vault'
import { createMarkdownRenderer } from '@/utils/exportHtml'
import { sanitizeMarkdown } from '@/utils/security'
import { extractMarkdownBlocks } from '@/utils/wikiLinks'

const MEDIA_EXTENSIONS = {
  image: ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.avif'],
  audio: ['.mp3', '.wav', '.ogg', '.m4a', '.flac'],
  video: ['.mp4', '.webm', '.mov'],
  pdf: ['.pdf'],
} as const
const MAX_DEPTH = 3
type AssetEmbedType = keyof typeof MEDIA_EXTENSIONS

export interface EmbedResult {
  type: 'note' | AssetEmbedType | 'not-found'
  filePath?: string
  content?: string          // rendered HTML (note) or data URL (asset)
  rawContent?: string       // raw Markdown (for editor preview)
  heading?: string
  sourceLine?: number       // source file line number (for navigation)
}

export function getAssetEmbedType(path: string): AssetEmbedType | null {
  const lower = path.toLowerCase()
  for (const [type, extensions] of Object.entries(MEDIA_EXTENSIONS) as Array<[AssetEmbedType, readonly string[]]>) {
    if (extensions.some(ext => lower.endsWith(ext))) return type
  }
  return null
}

function dirname(path: string): string {
  const normalized = path.replace(/\/+$/g, '')
  const index = normalized.lastIndexOf('/')
  return index > 0 ? normalized.slice(0, index) : '/workspace'
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
  if (parts[0] === 'workspace') return `/${parts.join('/')}`
  return `/workspace/${parts.join('/')}`
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items))
}

export function resolveAssetPathCandidates(target: string, sourcePath?: string): string[] {
  if (target.startsWith('/')) return [normalizeWorkspacePath(target)]
  const normalizedTarget = target.replace(/\\/g, '/')
  const currentDir = sourcePath ? dirname(sourcePath) : '/workspace'
  if (normalizedTarget.startsWith('./') || normalizedTarget.startsWith('../')) {
    return [normalizeWorkspacePath(`${currentDir}/${normalizedTarget}`)]
  }
  return unique([
    normalizeWorkspacePath(`${currentDir}/${normalizedTarget}`),
    normalizeWorkspacePath(`/workspace/${normalizedTarget}`),
  ])
}

function resolveNotePath(target: string, sourcePath?: string): string {
  if (!target.trim() && sourcePath) return sourcePath
  let path = target
  if (!path.startsWith('/')) {
    path = `/workspace/${path}`
  }
  if (!path.endsWith('.md')) {
    path = `${path}.md`
  }
  return path
}

/**
 * Extract a section from markdown content by heading.
 * Returns the lines from the matched heading to the next same-level or higher heading.
 */
function extractSection(content: string, heading: string): { lines: string[]; sourceLine: number } | undefined {
  const lines = content.split('\n')
  const headingRegex = /^(#{1,6})\s+(.+)$/

  let startLine = -1
  let matchedLevel = -1

  for (let i = 0; i < lines.length; i++) {
    const match = headingRegex.exec(lines[i])
    if (match) {
      const level = match[1].length
      const title = match[2].trim()
      if (title === heading && startLine === -1) {
        startLine = i
        matchedLevel = level
      } else if (startLine !== -1 && level <= matchedLevel) {
        // Found a same-level or higher heading after the match — stop here
        return { lines: lines.slice(startLine, i), sourceLine: startLine + 1 }
      }
    }
  }

  if (startLine !== -1) {
    // Heading was the last section — return to end of file
    return { lines: lines.slice(startLine), sourceLine: startLine + 1 }
  }

  return undefined
}

export async function resolveEmbed(
  target: string,
  heading?: string,
  depth = 0,
  sourcePath?: string,
  currentContent?: string
): Promise<EmbedResult> {
  if (depth > MAX_DEPTH) {
    return { type: 'not-found' }
  }

  // Asset handling
  const assetType = getAssetEmbedType(target)
  if (assetType) {
    const candidates = resolveAssetPathCandidates(target, sourcePath)
    for (const assetPath of candidates) {
      try {
        const dataUrl = await vaultService.readAsset(assetPath)
        if (dataUrl) return { type: assetType, filePath: assetPath, content: dataUrl }
      } catch (err) {
        console.error(`[embedResolver] Failed to read asset at ${assetPath}:`, err)
        // Try the next resolution candidate.
      }
    }
    return { type: 'not-found', filePath: candidates[0] }
  }

  // Note handling
  const notePath = resolveNotePath(target, sourcePath)
  const rawContent = !target.trim() && currentContent !== undefined
    ? currentContent
    : await vaultService.readFileOrEmpty(notePath)
  if (!rawContent) {
    return { type: 'not-found', filePath: notePath }
  }

  let contentToRender = rawContent
  let sourceLine: number | undefined
  let matchedHeading: string | undefined

  if (heading?.startsWith('^')) {
    const blockId = heading.slice(1).trim()
    const block = extractMarkdownBlocks(rawContent).find(item => item.id === blockId)
    if (!block) {
      return { type: 'not-found', filePath: notePath, heading }
    }
    contentToRender = block.text
    sourceLine = block.lineNumber
    matchedHeading = `^${block.id}`
  } else if (heading) {
    const section = extractSection(rawContent, heading)
    if (!section) {
      return { type: 'not-found', filePath: notePath, heading }
    }
    contentToRender = section.lines.join('\n')
    sourceLine = section.sourceLine
    matchedHeading = heading
  }

  const headings: Array<{ level: number; slug: string; title: string }> = []
  const md = createMarkdownRenderer({ headings })
  const renderedHtml = sanitizeMarkdown(md.render(contentToRender))

  return {
    type: 'note',
    filePath: notePath,
    content: renderedHtml,
    rawContent: contentToRender,
    heading: matchedHeading,
    sourceLine,
  }
}
