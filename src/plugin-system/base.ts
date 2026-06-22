import type { Plugin, PluginContext, PluginManifest, PluginSettingsSchema } from './types'

/**
 * Base class for plugins. Subclasses only need to implement activate/deactivate.
 * Provides convenience access to the plugin context and auto-cleanup for registrations.
 */
export abstract class BasePlugin implements Plugin {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly version: string
  readonly icon?: string
  readonly author?: string
  readonly dependencies?: string[]
  readonly settingsSchema?: PluginSettingsSchema
  readonly defaultSettings?: Record<string, unknown>
  readonly enabledByDefault?: boolean

  protected ctx!: PluginContext
  private cleanups: Array<() => void> = []

  constructor(manifest: PluginManifest) {
    this.id = manifest.id
    this.name = manifest.name
    this.description = manifest.description
    this.version = manifest.version
    this.icon = manifest.icon
    this.author = manifest.author
    this.dependencies = manifest.dependencies
    this.settingsSchema = manifest.settingsSchema
    this.defaultSettings = manifest.defaultSettings
    this.enabledByDefault = manifest.enabledByDefault
  }

  async activate(ctx: PluginContext): Promise<void> {
    this.ctx = ctx
    await this.onActivate()
  }

  async deactivate(): Promise<void> {
    await this.onDeactivate()
    // Auto-cleanup all registrations
    for (const cleanup of this.cleanups) {
      try { cleanup() } catch (e) { console.error(`[${this.id}] Cleanup error:`, e) }
    }
    this.cleanups = []
  }

  /** Subclasses implement this to register their features. */
  protected abstract onActivate(): void | Promise<void>

  /** Subclasses can override this for custom cleanup logic. */
  protected onDeactivate(): void | Promise<void> {}

  // ─── Convenience registration helpers with auto-cleanup ───

  protected addCommand(cmd: Parameters<PluginContext['registerCommand']>[0]): void {
    this.cleanups.push(this.ctx.registerCommand(cmd))
  }

  protected addAgentTool(tool: Parameters<PluginContext['registerAgentTool']>[0]): void {
    this.cleanups.push(this.ctx.registerAgentTool(tool))
  }

  protected addSidebarTab(tab: Parameters<PluginContext['registerSidebarTab']>[0]): void {
    this.cleanups.push(this.ctx.registerSidebarTab(tab))
  }

  protected addEditorExtension(ext: Parameters<PluginContext['registerEditorExtension']>[0]): void {
    this.cleanups.push(this.ctx.registerEditorExtension(ext))
  }

  protected addKeybinding(kb: Parameters<PluginContext['registerKeybinding']>[0]): void {
    this.cleanups.push(this.ctx.registerKeybinding(kb))
  }

  protected addToolbarItem(item: Parameters<PluginContext['registerToolbarItem']>[0]): void {
    this.cleanups.push(this.ctx.registerToolbarItem(item))
  }

  protected addStatusBarItem(item: Parameters<PluginContext['registerStatusBarItem']>[0]): void {
    this.cleanups.push(this.ctx.registerStatusBarItem(item))
  }

  protected addSettingPanel(panel: Parameters<PluginContext['registerSettingPanel']>[0]): void {
    this.cleanups.push(this.ctx.registerSettingPanel(panel))
  }

  /** Register any cleanup function to run on deactivate. */
  protected addCleanup(fn: () => void): void {
    this.cleanups.push(fn)
  }

  // ─── Settings convenience ───

  protected getSetting<T>(key: string, defaultValue: T): T {
    return this.ctx.settings.get<T>(this.id, key, defaultValue)
  }

  protected setSetting(key: string, value: unknown): void {
    this.ctx.settings.set(this.id, key, value)
  }

  protected getAllSettings(): Record<string, unknown> {
    return this.ctx.settings.getAll(this.id)
  }
}
