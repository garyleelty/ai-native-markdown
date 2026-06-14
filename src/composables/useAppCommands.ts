import { type Ref } from 'vue'
import { ElMessage } from 'element-plus'
import { aiService } from '@/services/ai'
import { safeStorage } from '@/utils/security'
import type { SidebarTab } from '@/types'

export function useAppCommands(options: {
  editorStore: { setViewMode: (mode: any) => void }
  settingsStore: any
  sidebarRef: () => any
  editorRef: () => any
  chatPanelRef: () => { clearMessages?: () => void } | null
  showCommandPalette: () => Ref<boolean>
  showTemplateGallery: () => Ref<boolean>
  showVersionHistory: () => Ref<boolean>
  showExportDialog: () => Ref<boolean>
  showCheatsheet: () => Ref<boolean>
  focusMode: () => Ref<boolean>
  handleFileSelect: (filePath: string, options?: any) => Promise<void>
  refreshMarkdownPaths: () => Promise<void>
  saveCurrentFile: () => void
  exportAsMarkdown: () => void
  exportAsHTML: () => Promise<void>
  toggleSidebar: () => void
  toggleAIPanel: () => void
  toggleGraphPane: () => void
  toggleRightDock: () => void
  toggleTheme: () => void
  ensureMobileSidebar: () => Promise<void>
  openDailyNote: () => Promise<void>
  migrationAudit: { openMigrationAudit: () => void }
}) {
  const handleClearAIChat = () => {
    options.chatPanelRef()?.clearMessages?.()
    safeStorage.set('ai_chat_history', [])
    ElMessage.success('已清空对话')
  }

  const handleTestAIConnection = async () => {
    const provider = aiService.getActiveProvider()
    if (!provider) {
      ElMessage.warning('AI Provider 未就绪，请在 AI 配置中检查模型和连接')
      return
    }
    try {
      const result = await provider.testConnection()
      if (result.ok) {
        ElMessage.success(result.error ? `AI 连接成功：${result.error}` : 'AI 连接成功')
      } else {
        ElMessage.error(result.error || 'AI 连接失败')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      ElMessage.error(`AI 连接失败: ${message}`)
    }
  }

  const openSidebarTab = async (tab: SidebarTab) => {
    await options.ensureMobileSidebar()
    options.sidebarRef()?.openTab?.(tab)
  }

  const refreshKnowledgeIndexFromCommand = async () => {
    try {
      await options.ensureMobileSidebar()
      const sidebar = options.sidebarRef()
      if (!sidebar?.refreshKnowledgeIndex) {
        throw new Error('知识面板未就绪')
      }
      await sidebar.refreshKnowledgeIndex({ waitForPanels: false })
      ElMessage.success({ message: '知识索引已刷新', duration: 6000 })
    } catch {
      ElMessage.error('刷新知识索引失败')
    }
  }

  const focusFileSearchFromCommand = async (mode: 'name' | 'content') => {
    await options.ensureMobileSidebar()
    await options.sidebarRef()?.focusFileSearch?.(mode)
  }

  const openFolderFromCommand = async () => {
    await options.ensureMobileSidebar()
    await options.sidebarRef()?.openFolder?.()
    await options.refreshMarkdownPaths()
  }

  const handleCommandExecute = (command: string) => {
    options.showCommandPalette().value = false
    const quickOpenPrefix = 'file.quick-open:'
    if (command.startsWith(quickOpenPrefix)) {
      void options.handleFileSelect(command.slice(quickOpenPrefix.length))
      return
    }

    const actions: Record<string, () => void | Promise<void>> = {
      'file.new': () => options.sidebarRef()?.handleCreateFile?.(),
      'file.new-folder': () => options.sidebarRef()?.handleCreateFolder?.(),
      'file.open': () => openFolderFromCommand(),
      'file.open-folder': () => openFolderFromCommand(),
      'file.new-from-template': () => { options.showTemplateGallery().value = true },
      'file.daily-note': () => { void options.openDailyNote() },
      'file.version-history': () => { options.showVersionHistory().value = true },
      'file.save': () => options.saveCurrentFile(),
      'file.export-md': () => options.exportAsMarkdown(),
      'file.export-html': () => { void options.exportAsHTML() },
      'search.file-name': () => focusFileSearchFromCommand('name'),
      'search.content': () => focusFileSearchFromCommand('content'),
      'edit.bold': () => options.editorRef()?.wrapSelection?.('**', '**'),
      'edit.italic': () => options.editorRef()?.wrapSelection?.('*', '*'),
      'edit.strikethrough': () => options.editorRef()?.wrapSelection?.('~~', '~~'),
      'edit.heading1': () => options.editorRef()?.insertLine?.('# '),
      'edit.heading2': () => options.editorRef()?.insertLine?.('## '),
      'edit.heading3': () => options.editorRef()?.insertLine?.('### '),
      'edit.code-block': () => options.editorRef()?.insertLine?.('```\n\n```'),
      'edit.link': () => options.editorRef()?.insertLink?.(),
      'edit.image': () => options.editorRef()?.insertImage?.(),
      'view.sidebar': () => options.toggleSidebar(),
      'view.ai-panel': () => options.toggleAIPanel(),
      'view.graph-workbench': () => options.toggleGraphPane(),
      'view.right-dock': () => options.toggleRightDock(),
      'view.files-panel': () => openSidebarTab('files'),
      'view.knowledge-panel': () => openSidebarTab('knowledge'),
      'view.ai-settings': () => openSidebarTab('settings'),
      'view.outline': () => openSidebarTab('knowledge'),
      'view.settings': () => openSidebarTab('settings'),
      'view.source': () => options.editorStore.setViewMode('source'),
      'view.live-preview': () => options.editorStore.setViewMode('live-preview'),
      'view.preview': () => options.editorStore.setViewMode('preview'),
      'view.theme': () => options.toggleTheme(),
      'view.focus-mode': () => { options.focusMode().value = !options.focusMode().value },
      'view.cheatsheet': () => { options.showCheatsheet().value = true },
      'view.export': () => { options.showExportDialog().value = true },
      'file.export': () => { options.showExportDialog().value = true },
      'ai.clear': () => handleClearAIChat(),
      'ai.clear-chat': () => handleClearAIChat(),
      'ai.test': () => { void handleTestAIConnection() },
      'ai.test-connection': () => { void handleTestAIConnection() },
      'knowledge.refresh-index': () => refreshKnowledgeIndexFromCommand(),
      'knowledge.migration-audit': () => options.migrationAudit.openMigrationAudit(),
    }
    void actions[command]?.()
  }

  return { handleCommandExecute }
}
