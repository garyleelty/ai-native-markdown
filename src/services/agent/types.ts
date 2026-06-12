export interface ToolParameter {
  name: string
  type: 'string' | 'number' | 'boolean' | 'array'
  description: string
  required?: boolean
  enum?: string[]
}

export interface AgentTool {
  name: string
  description: string
  parameters: ToolParameter[]
  riskLevel: 'low' | 'high'
  execute: (params: Record<string, unknown>) => Promise<ToolResult>
}

export interface ToolResult {
  success: boolean
  data?: unknown
  display?: string
  error?: string
}

export interface ToolCallRecord {
  tool: string
  params: Record<string, unknown>
  result: ToolResult
  timestamp: number
}

export interface AgentContext {
  currentFile: {
    path: string
    content: string
    frontmatter?: Record<string, unknown>
    tags: string[]
  } | null
  backlinks: Array<{ path: string; context: string }>
  mentions: Array<{ path: string; context: string }>
  recentFiles: string[]
  ragContext?: string
  // 图谱洞察
  graphInsights?: GraphInsights
}

// 图谱洞察
export interface GraphInsights {
  totalNotes: number
  totalLinks: number
  orphanCount: number
  currentNotePosition?: {
    linkCount: number
    isOrphan: boolean
    neighbors: Array<{ title: string; path: string }>
  }
  suggestions?: Array<{
    type: 'connect-orphan' | 'similar-topic' | 'missing-link'
    note: string
    path: string
    reason: string
  }>
}

export interface AgentOptions {
  context?: AgentContext
  tools?: string[]
  maxSteps?: number
  onToolCall?: (record: ToolCallRecord) => void
  onProgress?: (message: string) => void
  onConfirm?: (tool: string, params: Record<string, unknown>) => Promise<boolean>
  onFilesModified?: (files: string[]) => void
  signal?: AbortSignal
}

export interface AgentConfig {
  maxSteps: number
  allowedTools: string[]
  agentMode: boolean
}

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  maxSteps: 10,
  allowedTools: [],
  agentMode: false
}

export interface AgentResult {
  success: boolean
  message: string
  toolCalls: ToolCallRecord[]
  filesModified: string[]
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_call_id?: string
  tool_calls?: Array<{
    id: string
    type: string
    function: {
      name: string
      arguments: string
    }
  }>
}

export interface ToolCallDef {
  id: string
  name: string
  arguments: string
}
