import type { Extension } from '@codemirror/state'
import type { SlashCommand } from '@/services/commandRegistry'
import type { AgentTool } from '@/services/agent/types'
import type { VaultService } from '@/services/vault'
import type { AIProvider } from '@/services/ai'
import type { KnowledgeIndexRecord, KnowledgeReference } from '@/services/knowledgeIndex'

// ─── Plugin Settings ───

export interface PluginSettingField {
  key: string
  label: string
  type: 'text' | 'number' | 'boolean' | 'select' | 'textarea'
  description?: string
  default?: unknown
  options?: Array<{ label: string; value: unknown }>
  min?: number
  max?: number
}

export type PluginSettingsSchema = PluginSettingField[]

// ─── Sidebar Tab ───

export interface PluginSidebarTab {
  id: string
  label: string
  icon: string           // Element Plus icon name or emoji
  ariaLabel?: string
  component: () => Promise<{ default: any }>  // async component loader
  props?: () => Record<string, unknown>
}

// ─── Keybinding ───

export interface PluginKeybinding {
  key: string
  run: () => void
  preventDefault?: boolean
}

// ─── Setting Panel ───

export interface PluginSettingPanel {
  id: string
  label: string
  component: () => Promise<{ default: any }>
}

// ─── Editor Toolbar Item ───

export interface PluginToolbarItem {
  id: string
  group: 'history' | 'format' | 'code' | 'insert' | 'view' | 'more'
  label: string
  icon?: string
  tooltip?: string
  action: () => void
  condition?: () => boolean
}

// ─── Status Bar Item ───

export interface PluginStatusBarItem {
  id: string
  position: 'left' | 'right'
  component: () => Promise<{ default: any }>
  order?: number
}

// ─── App API (given to plugins) ───

export interface AppEventMap {
  'file:opened': { path: string }
  'file:saved': { path: string }
  'file:created': { path: string }
  'file:deleted': { path: string }
  'file:renamed': { oldPath: string; newPath: string }
  'editor:content-changed': { content: string }
  'editor:cursor-changed': { line: number }
  'editor:selection-changed': { text: string }
  'vault:changed': { path?: string }
  'theme:changed': { isDark: boolean }
}

export interface AppAPI {
  on<K extends keyof AppEventMap>(event: K, handler: (payload: AppEventMap[K]) => void): () => void
  emit<K extends keyof AppEventMap>(event: K, payload: AppEventMap[K]): void
  notify(message: string, type?: 'success' | 'warning' | 'info' | 'error'): void
}

// ─── Editor API (given to plugins) ───

export interface EditorAPI {
  getCurrentFile(): string | null
  getContent(): string
  setContent(content: string): void
  getSelection(): string
  insertText(text: string): void
  replaceSelection(text: string): void
  wrapSelection(before: string, after: string): void
  getCursorPosition(): { line: number; ch: number }
  getMarkdownPaths(): string[]
  readFile(path: string): Promise<string>
}

// ─── Settings API (given to plugins) ───

export interface SettingsAPI {
  get<T>(pluginId: string, key: string, defaultValue: T): T
  set(pluginId: string, key: string, value: unknown): void
  getAll(pluginId: string): Record<string, unknown>
}

// ─── Plugin Context (the full API surface for plugins) ───

export interface PluginContext {
  // Core services
  vault: VaultService
  knowledgeIndex: {
    indexFile(path: string, content: string): Promise<void>
    removeByPrefix(path: string): Promise<void>
    rebuild(files: Array<{ path: string; content: string }>): Promise<void>
    getBacklinks(filePath: string): Promise<KnowledgeReference[]>
    getUnlinkedMentions(filePath: string): Promise<KnowledgeReference[]>
    search(query: string): Promise<unknown[]>
    getAll(): Promise<KnowledgeIndexRecord[]>
  }

  // Registration APIs
  registerCommand(cmd: SlashCommand): () => void
  registerAgentTool(tool: AgentTool): () => void
  registerSidebarTab(tab: PluginSidebarTab): () => void
  registerEditorExtension(ext: Extension | (() => Extension)): () => void
  registerKeybinding(kb: PluginKeybinding): () => void
  registerToolbarItem(item: PluginToolbarItem): () => void
  registerStatusBarItem(item: PluginStatusBarItem): () => void
  registerSettingPanel(panel: PluginSettingPanel): () => void

  // High-level APIs
  editor: EditorAPI
  app: AppAPI
  settings: SettingsAPI
}

// ─── Plugin Manifest (static declaration) ───

export interface PluginManifest {
  id: string
  name: string
  description: string
  version: string
  icon?: string
  author?: string
  dependencies?: string[]
  settingsSchema?: PluginSettingsSchema
  defaultSettings?: Record<string, unknown>
  enabledByDefault?: boolean
}

// ─── Plugin (runtime instance) ───

export interface Plugin extends PluginManifest {
  activate(ctx: PluginContext): void | Promise<void>
  deactivate(): void | Promise<void>
}

// ─── Plugin State (managed by PluginManager) ───

export type PluginState = 'registered' | 'activating' | 'active' | 'deactivating' | 'inactive' | 'error'

export interface PluginInfo {
  plugin: Plugin
  state: PluginState
  error?: string
  settings: Record<string, unknown>
  enabled: boolean
}
