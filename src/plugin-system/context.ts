import type { PluginContext, AppAPI, EditorAPI, SettingsAPI, AppEventMap } from './types'
import { pluginManager } from './manager'
import { vaultService } from '@/services/vault'
import { knowledgeIndex } from '@/services/knowledgeIndex'
import { safeStorage } from '@/utils/security'

// ─── Event Bus ───

type EventHandler = (payload: any) => void
const eventHandlers = new Map<string, Set<EventHandler>>()

const appAPI: AppAPI = {
  on(event, handler) {
    if (!eventHandlers.has(event)) eventHandlers.set(event, new Set())
    eventHandlers.get(event)!.add(handler)
    return () => { eventHandlers.get(event)?.delete(handler) }
  },
  emit(event, payload) {
    for (const handler of eventHandlers.get(event) ?? []) {
      try { handler(payload) } catch (e) { console.error(`[AppAPI] Event handler error for "${event}":`, e) }
    }
  },
  notify(message, type = 'info') {
    import('element-plus').then(({ ElMessage }) => {
      ElMessage[type]({ message, duration: type === 'error' ? 5000 : 3000 })
    })
  },
}

// ─── Editor API (will be bound at runtime) ───

let editorAPIInstance: EditorAPI | null = null

export function bindEditorAPI(api: EditorAPI): void {
  editorAPIInstance = api
}

const editorAPIProxy: EditorAPI = {
  getCurrentFile: () => editorAPIInstance?.getCurrentFile() ?? null,
  getContent: () => editorAPIInstance?.getContent() ?? '',
  setContent: (c) => editorAPIInstance?.setContent(c),
  getSelection: () => editorAPIInstance?.getSelection() ?? '',
  insertText: (t) => editorAPIInstance?.insertText(t),
  replaceSelection: (t) => editorAPIInstance?.replaceSelection(t),
  wrapSelection: (b, a) => editorAPIInstance?.wrapSelection(b, a),
  getCursorPosition: () => editorAPIInstance?.getCursorPosition() ?? { line: 0, ch: 0 },
  getMarkdownPaths: () => editorAPIInstance?.getMarkdownPaths() ?? [],
  readFile: (p) => editorAPIInstance?.readFile(p) ?? Promise.resolve(''),
}

// ─── Settings API ───

const SETTINGS_PREFIX = 'plugin-settings:'

const settingsAPI: SettingsAPI = {
  get<T>(pluginId: string, key: string, defaultValue: T): T {
    const all = safeStorage.get<Record<string, unknown>>(`${SETTINGS_PREFIX}${pluginId}`, {})
    return (all[key] as T) ?? defaultValue
  },
  set(pluginId: string, key: string, value: unknown): void {
    const all = safeStorage.get<Record<string, unknown>>(`${SETTINGS_PREFIX}${pluginId}`, {})
    all[key] = value
    safeStorage.set(`${SETTINGS_PREFIX}${pluginId}`, all)
  },
  getAll(pluginId: string): Record<string, unknown> {
    return safeStorage.get<Record<string, unknown>>(`${SETTINGS_PREFIX}${pluginId}`, {})
  },
}

// ─── Knowledge Index Adapter ───

const knowledgeIndexAdapter = {
  indexFile: (path: string, content: string) => knowledgeIndex.indexFile(path, content),
  removeByPrefix: (path: string) => knowledgeIndex.removeByPrefix(path),
  rebuild: (files: Array<{ path: string; content: string }>) => knowledgeIndex.rebuild(files),
  getBacklinks: (filePath: string) => knowledgeIndex.getBacklinks(filePath),
  getUnlinkedMentions: (filePath: string) => knowledgeIndex.getUnlinkedMentions(filePath),
  search: async (query: string) => {
    const results: any[] = []
    await knowledgeIndex.searchRegex(query, '', 50, 5, (filePath, fileName, matches) => {
      results.push({ filePath, fileName, matches })
    })
    return results
  },
  getAll: () => knowledgeIndex.getAll(),
}

// ─── Plugin Context Factory ───

export function createPluginContext(): PluginContext {
  return {
    vault: vaultService,
    knowledgeIndex: knowledgeIndexAdapter,

    registerCommand: (cmd) => pluginManager.addCommand(cmd),
    registerAgentTool: (tool) => pluginManager.addAgentTool(tool),
    registerSidebarTab: (tab) => pluginManager.addSidebarTab(tab),
    registerEditorExtension: (ext) => pluginManager.addEditorExtension(ext),
    registerKeybinding: (kb) => pluginManager.addKeybinding(kb),
    registerToolbarItem: (item) => pluginManager.addToolbarItem(item),
    registerStatusBarItem: (item) => pluginManager.addStatusBarItem(item),
    registerSettingPanel: (panel) => pluginManager.addSettingPanel(panel),

    editor: editorAPIProxy,
    app: appAPI,
    settings: settingsAPI,
  }
}
