export interface FileItem {
  id: string
  name: string
  path: string
  parentPath: string
  isDirectory: boolean
  isMarkdown: boolean
  modifiedAt: number
  size: number
}

export interface TreeNode {
  id: string
  name: string
  path: string
  isDirectory: boolean
  isMarkdown: boolean
  children?: TreeNode[]
  isExpanded?: boolean
  isEditing?: boolean
  isNew?: boolean
  editValue?: string
  error?: string
}

export interface DocumentMeta {
  path: string
  title: string
  summary: string
  tags: string[]
  links: string[]
  backlinks: string[]
  createdAt: number
  updatedAt: number
  readTime: number
}

export interface AIConfig {
  provider: 'ollama' | 'openai' | 'deepseek' | 'custom'
  baseURL: string
  apiKey: string
  model: string
  temperature: number
  maxTokens: number
  systemPrompt: string
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AIRAGSource {
  id: string
  filePath: string
  chunkIndex: number
  lineStart?: number
  lineEnd?: number
  excerpt?: string
  relevance: number
}

export interface ToolCallDisplay {
  tool: string
  params: Record<string, unknown>
  result: {
    success: boolean
    display?: string
    error?: string
  }
  timestamp: number
}

export interface AIMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  ragSources?: AIRAGSource[]
  toolCalls?: ToolCallDisplay[]
}

export interface Workspace {
  id: string
  name: string
  path: string
  lastOpened: number
}

export type ViewMode = 'source' | 'live-preview' | 'preview'
export type ThemeMode = 'dark' | 'light' | 'system'
export type SidebarTab = 'files' | 'graph' | 'ai' | 'outline' | 'settings' | 'rss'

export interface GraphNode {
  id: string
  label: string
  path: string
  linkCount: number
  tags: string[]
  isOrphan: boolean
  x?: number
  y?: number
  fx?: number | null
  fy?: number | null
}

export interface GraphEdge {
  source: string | GraphNode
  target: string | GraphNode
  weight: number
}

export interface GhostTextConfig {
  enabled: boolean
  debounceMs: number
  maxPrefixChars: number
  maxCompletionChars: number
  triggerMode: 'pause' | 'manual'
}

export interface KnowledgeGraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
  stats: {
    totalNodes: number
    totalEdges: number
    orphanCount: number
    avgLinkCount: number
  }
}

// RSS 相关类型定义
export interface RSSFeed {
  id: string
  url: string
  title: string
  description: string
  siteUrl: string
  lastFetchedAt?: number
  fetchIntervalMinutes: number
  autoImport: boolean
  importPath: string
  createdAt: number
  updatedAt: number
}

export interface RSSArticle {
  id: string
  feedId: string
  guid: string
  title: string
  link: string
  pubDate: number
  author?: string
  description: string
  content: string
  categories: string[]
  imageUrl?: string
  isImported: boolean
  importedPath?: string
  importedAt?: number
  createdAt: number
}

export interface RSSImportOptions {
  chunkSize: number // 分块大小（字数）
  includeImages: boolean
  includeLinks: boolean
  template: string // 文档模板
}

export interface RSSFetchResult {
  articles: RSSArticle[]
  newArticles: number
  updatedArticles: number
  skippedArticles: number
  error?: string
}
