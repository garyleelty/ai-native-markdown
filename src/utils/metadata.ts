export type FrontmatterValue = string | number | boolean | string[]

export interface ParsedMarkdownMetadata {
  title: string
  aliases: string[]
  tags: string[]
  links: string[]
  frontmatter: Record<string, FrontmatterValue>
  searchableText: string
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/
const WIKI_LINK_RE = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g
const TAG_RE = /(^|\s)#([\w\u4e00-\u9fa5_-]+)/g

function parseScalar(raw: string): FrontmatterValue {
  const value = raw.trim()
  if (value === 'true') return true
  if (value === 'false') return false
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value)
  if (value.startsWith('[') && value.endsWith(']')) {
    return value
      .slice(1, -1)
      .split(',')
      .map(item => item.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean)
  }
  return value.replace(/^['"]|['"]$/g, '')
}

export function parseFrontmatter(content: string): {
  frontmatter: Record<string, FrontmatterValue>
  body: string
} {
  const match = content.match(FRONTMATTER_RE)
  if (!match) return { frontmatter: {}, body: content }

  const frontmatter: Record<string, FrontmatterValue> = {}
  const lines = match[1].split(/\r?\n/)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const keyMatch = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/)
    if (!keyMatch) continue

    const [, key, rawValue] = keyMatch
    if (rawValue.trim()) {
      frontmatter[key] = parseScalar(rawValue)
      continue
    }

    const list: string[] = []
    while (i + 1 < lines.length && /^\s*-\s+/.test(lines[i + 1])) {
      i++
      list.push(lines[i].replace(/^\s*-\s+/, '').trim().replace(/^['"]|['"]$/g, ''))
    }
    frontmatter[key] = list
  }

  return { frontmatter, body: content.slice(match[0].length) }
}

function toStringArray(value: FrontmatterValue | undefined): string[] {
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    return value
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)
  }
  return []
}

export function normalizeNoteName(value: string): string {
  return value
    .trim()
    .replace(/\.md$/i, '')
    .replace(/\.markdown$/i, '')
    .toLowerCase()
}

export function parseMarkdownMetadata(path: string, content: string): ParsedMarkdownMetadata {
  const { frontmatter, body } = parseFrontmatter(content)
  const fileTitle = path.split('/').pop()?.replace(/\.md$|\.markdown$/i, '') || 'Untitled'
  const headingTitle = body.match(/^#\s+(.+)$/m)?.[1]?.trim()
  const frontmatterTitle = typeof frontmatter.title === 'string' ? frontmatter.title : ''
  const title = frontmatterTitle || headingTitle || fileTitle

  const aliases = [...new Set([
    ...toStringArray(frontmatter.alias),
    ...toStringArray(frontmatter.aliases),
  ])]

  const links = new Set<string>()
  let linkMatch: RegExpExecArray | null
  while ((linkMatch = WIKI_LINK_RE.exec(body)) !== null) {
    links.add(linkMatch[1].trim())
  }

  const tags = new Set<string>(toStringArray(frontmatter.tags).map(tag => tag.replace(/^#/, '')))
  let tagMatch: RegExpExecArray | null
  while ((tagMatch = TAG_RE.exec(body)) !== null) {
    tags.add(tagMatch[2])
  }

  const searchableText = body
    .replace(WIKI_LINK_RE, '$1')
    .replace(TAG_RE, ' $2')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[^\p{L}\p{N}\s_-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return {
    title,
    aliases,
    tags: [...tags],
    links: [...links],
    frontmatter,
    searchableText,
  }
}
