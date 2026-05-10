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

export interface AIMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}

export interface ScheduledTask {
  id: string
  name: string
  type: 'backup' | 'reminder' | 'ai-process'
  cron: string
  enabled: boolean
  lastRun: number
  nextRun: number
  config: Record<string, unknown>
}

export interface Workspace {
  id: string
  name: string
  path: string
  lastOpened: number
}

export type ViewMode = 'split' | 'source' | 'preview'
export type ThemeMode = 'dark' | 'light' | 'system'
export type SidebarTab = 'files' | 'search' | 'knowledge' | 'tasks' | 'settings'
