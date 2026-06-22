import { pluginManager } from '@/plugin-system'

// Import all plugins
import { templatesPlugin } from './templates'
import { dailyNotesPlugin } from './daily-notes'
import { exportPlugin } from './export'
import { ghostTextPlugin } from './ghost-text'
import { inlineEditPluginInstance } from './inline-edit'
import { aiActionsPluginInstance } from './ai-actions'
import { livePreviewPluginInstance } from './live-preview'
import { smartPastePluginInstance } from './smart-paste'
import { slashCommandsPluginInstance } from './slash-commands'
import { multimodalPluginInstance } from './multimodal'
import { globalSearchPluginInstance } from './global-search'
import { knowledgeGraphPluginInstance } from './knowledge-graph'
import { rssPluginInstance } from './rss'
import { versionHistoryPluginInstance } from './version-history'
import { migrationAuditPluginInstance } from './migration-audit'
import { aiPanelPluginInstance } from './ai-panel'

/**
 * Register all built-in plugins with the plugin manager.
 * Called once during app initialization.
 */
export function registerAllPlugins(): void {
  // Core productivity
  pluginManager.register(templatesPlugin)
  pluginManager.register(dailyNotesPlugin)
  pluginManager.register(exportPlugin)

  // Editor extensions
  pluginManager.register(slashCommandsPluginInstance)
  pluginManager.register(livePreviewPluginInstance)
  pluginManager.register(smartPastePluginInstance)
  pluginManager.register(ghostTextPlugin)
  pluginManager.register(inlineEditPluginInstance)
  pluginManager.register(aiActionsPluginInstance)
  pluginManager.register(multimodalPluginInstance)

  // Sidebar panels
  pluginManager.register(globalSearchPluginInstance)
  pluginManager.register(knowledgeGraphPluginInstance)
  pluginManager.register(rssPluginInstance)

  // Features
  pluginManager.register(versionHistoryPluginInstance)
  pluginManager.register(migrationAuditPluginInstance)
  pluginManager.register(aiPanelPluginInstance)
}
