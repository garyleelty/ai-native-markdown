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

export interface AIMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}

export interface Workspace {
  id: string
  name: string
  path: string
  lastOpened: number
}

export type ViewMode = 'source' | 'preview' | 'split'
export type ThemeMode = 'dark' | 'light' | 'system'
export type SidebarTab = 'files' | 'graph' | 'ai' | 'outline' | 'settings'

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
