import type {
  Plugin,
  PluginInfo,
  PluginState,
  PluginContext,
  PluginSidebarTab,
  PluginKeybinding,
  PluginToolbarItem,
  PluginStatusBarItem,
  PluginSettingPanel,
  PluginSettingsSchema,
} from './types'
import type { SlashCommand } from '@/services/commandRegistry'
import type { AgentTool } from '@/services/agent/types'
import type { Extension } from '@codemirror/state'
import { safeStorage } from '@/utils/security'
import { ref, type Ref } from 'vue'

const STORAGE_KEY = 'plugin-system:state'

interface StoredPluginState {
  enabled: Record<string, boolean>
  settings: Record<string, Record<string, unknown>>
}

class PluginManagerImpl {
  private plugins = new Map<string, PluginInfo>()
  private context: PluginContext | null = null

  // Registration collections (plugins contribute these)
  readonly sidebarTabs: Ref<PluginSidebarTab[]> = ref([])
  readonly editorExtensions: Ref<Array<Extension | (() => Extension)>> = ref([])
  readonly commands: Ref<SlashCommand[]> = ref([])
  readonly agentTools: Ref<AgentTool[]> = ref([])
  readonly keybindings: Ref<PluginKeybinding[]> = ref([])
  readonly toolbarItems: Ref<PluginToolbarItem[]> = ref([])
  readonly statusbarItems: Ref<PluginStatusBarItem[]> = ref([])
  readonly settingPanels: Ref<PluginSettingPanel[]> = ref([])

  // Unsubscribe functions for cleanup
  private unsubscribers: Array<() => void> = []

  setContext(ctx: PluginContext): void {
    this.context = ctx
  }

  register(plugin: Plugin): void {
    if (this.plugins.has(plugin.id)) {
      console.warn(`[PluginManager] Plugin "${plugin.id}" already registered`)
      return
    }

    // Validate dependencies
    if (plugin.dependencies) {
      for (const dep of plugin.dependencies) {
        if (!this.plugins.has(dep)) {
          console.warn(`[PluginManager] Plugin "${plugin.id}" depends on "${dep}" which is not registered`)
        }
      }
    }

    const stored = this.loadStoredState()
    const isEnabled = stored.enabled[plugin.id] ?? plugin.enabledByDefault ?? true
    const settings = { ...(plugin.defaultSettings ?? {}), ...(stored.settings[plugin.id] ?? {}) }

    this.plugins.set(plugin.id, {
      plugin,
      state: 'registered',
      settings,
      enabled: isEnabled,
    })
  }

  async activateAll(): Promise<void> {
    if (!this.context) {
      throw new Error('[PluginManager] Context not set. Call setContext() first.')
    }

    // Sort by dependencies (topological order)
    const sorted = this.topologicalSort()

    for (const info of sorted) {
      if (info.enabled) {
        await this.activatePlugin(info.plugin.id)
      }
    }
  }

  async activatePlugin(pluginId: string): Promise<void> {
    const info = this.plugins.get(pluginId)
    if (!info || !this.context) return

    if (info.state === 'active') return

    // Check dependencies are active
    if (info.plugin.dependencies) {
      for (const dep of info.plugin.dependencies) {
        const depInfo = this.plugins.get(dep)
        if (!depInfo || depInfo.state !== 'active') {
          info.state = 'error'
          info.error = `Dependency "${dep}" is not active`
          return
        }
      }
    }

    info.state = 'activating'
    try {
      await info.plugin.activate(this.context!)
      info.state = 'active'
      info.error = undefined
      info.enabled = true
      this.saveState()
    } catch (err) {
      info.state = 'error'
      info.error = err instanceof Error ? err.message : String(err)
      console.error(`[PluginManager] Failed to activate "${pluginId}":`, err)
    }
  }

  async deactivatePlugin(pluginId: string): Promise<void> {
    const info = this.plugins.get(pluginId)
    if (!info || info.state !== 'active') return

    // Check if other active plugins depend on this one
    for (const [id, other] of this.plugins) {
      if (id === pluginId) continue
      if (other.state === 'active' && other.plugin.dependencies?.includes(pluginId)) {
        info.state = 'error'
        info.error = `Cannot deactivate: "${id}" depends on this plugin`
        return
      }
    }

    info.state = 'deactivating'
    try {
      await info.plugin.deactivate()
      info.state = 'inactive'
      info.error = undefined
      info.enabled = false
      this.saveState()
    } catch (err) {
      info.state = 'error'
      info.error = err instanceof Error ? err.message : String(err)
      console.error(`[PluginManager] Failed to deactivate "${pluginId}":`, err)
    }
  }

  async togglePlugin(pluginId: string): Promise<void> {
    const info = this.plugins.get(pluginId)
    if (!info) return
    if (info.state === 'active') {
      await this.deactivatePlugin(pluginId)
    } else {
      await this.activatePlugin(pluginId)
    }
  }

  getPlugin(pluginId: string): PluginInfo | undefined {
    return this.plugins.get(pluginId)
  }

  getAllPlugins(): PluginInfo[] {
    return [...this.plugins.values()]
  }

  getActivePlugins(): PluginInfo[] {
    return [...this.plugins.values()].filter(p => p.state === 'active')
  }

  getPluginSettings(pluginId: string): Record<string, unknown> {
    return this.plugins.get(pluginId)?.settings ?? {}
  }

  updatePluginSetting(pluginId: string, key: string, value: unknown): void {
    const info = this.plugins.get(pluginId)
    if (!info) return
    info.settings[key] = value
    this.saveState()
  }

  getSettingsSchema(pluginId: string): PluginSettingsSchema {
    return this.plugins.get(pluginId)?.plugin.settingsSchema ?? []
  }

  // ─── Registration helpers (called by PluginContext) ───

  addSidebarTab(tab: PluginSidebarTab): () => void {
    this.sidebarTabs.value = [...this.sidebarTabs.value, tab]
    return () => {
      this.sidebarTabs.value = this.sidebarTabs.value.filter(t => t.id !== tab.id)
    }
  }

  addEditorExtension(ext: Extension | (() => Extension)): () => void {
    this.editorExtensions.value = [...this.editorExtensions.value, ext]
    return () => {
      this.editorExtensions.value = this.editorExtensions.value.filter(e => e !== ext)
    }
  }

  addCommand(cmd: SlashCommand): () => void {
    this.commands.value = [...this.commands.value, cmd]
    return () => {
      this.commands.value = this.commands.value.filter(c => c.id !== cmd.id)
    }
  }

  addAgentTool(tool: AgentTool): () => void {
    this.agentTools.value = [...this.agentTools.value, tool]
    return () => {
      this.agentTools.value = this.agentTools.value.filter(t => t.name !== tool.name)
    }
  }

  addKeybinding(kb: PluginKeybinding): () => void {
    this.keybindings.value = [...this.keybindings.value, kb]
    return () => {
      this.keybindings.value = this.keybindings.value.filter(k => k.key !== kb.key)
    }
  }

  addToolbarItem(item: PluginToolbarItem): () => void {
    this.toolbarItems.value = [...this.toolbarItems.value, item]
    return () => {
      this.toolbarItems.value = this.toolbarItems.value.filter(i => i.id !== item.id)
    }
  }

  addStatusBarItem(item: PluginStatusBarItem): () => void {
    this.statusbarItems.value = [...this.statusbarItems.value, item]
    return () => {
      this.statusbarItems.value = this.statusbarItems.value.filter(i => i.id !== item.id)
    }
  }

  addSettingPanel(panel: PluginSettingPanel): () => void {
    this.settingPanels.value = [...this.settingPanels.value, panel]
    return () => {
      this.settingPanels.value = this.settingPanels.value.filter(p => p.id !== panel.id)
    }
  }

  // ─── Private helpers ───

  private topologicalSort(): PluginInfo[] {
    const visited = new Set<string>()
    const result: PluginInfo[] = []

    const visit = (id: string) => {
      if (visited.has(id)) return
      visited.add(id)
      const info = this.plugins.get(id)
      if (!info) return
      if (info.plugin.dependencies) {
        for (const dep of info.plugin.dependencies) {
          visit(dep)
        }
      }
      result.push(info)
    }

    for (const id of this.plugins.keys()) {
      visit(id)
    }
    return result
  }

  private loadStoredState(): StoredPluginState {
    try {
      return safeStorage.get<StoredPluginState>(STORAGE_KEY, { enabled: {}, settings: {} })
    } catch {
      return { enabled: {}, settings: {} }
    }
  }

  private saveState(): void {
    const enabled: Record<string, boolean> = {}
    const settings: Record<string, Record<string, unknown>> = {}
    for (const [id, info] of this.plugins) {
      enabled[id] = info.enabled
      settings[id] = info.settings
    }
    safeStorage.set(STORAGE_KEY, { enabled, settings })
  }
}

export const pluginManager = new PluginManagerImpl()
