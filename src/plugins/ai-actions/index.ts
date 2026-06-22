import { BasePlugin } from '@/plugin-system'

class AIActionsPlugin extends BasePlugin {
  constructor() {
    super({
      id: 'ai-actions',
      name: 'AI 操作菜单',
      description: '编辑器内快捷 AI 操作菜单',
      version: '1.0.0',
      icon: 'Promotion',
      enabledByDefault: true,
    })
  }

  protected async onActivate(): Promise<void> {
    const { aiActionPlugin, aiActionKeymap } = await import('@/extensions/ai-actions/aiActionPlugin')
    await import('@/extensions/ai-actions/styles.css')
    this.addEditorExtension([aiActionPlugin, aiActionKeymap])
  }
}

export const aiActionsPluginInstance = new AIActionsPlugin()
