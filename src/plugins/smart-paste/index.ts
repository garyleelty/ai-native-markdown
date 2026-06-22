import { BasePlugin } from '@/plugin-system'

class SmartPastePlugin extends BasePlugin {
  constructor() {
    super({
      id: 'smart-paste',
      name: '智能粘贴',
      description: '自动识别并格式化粘贴内容为 Markdown',
      version: '1.0.0',
      icon: 'DocumentCopy',
      enabledByDefault: true,
    })
  }

  protected async onActivate(): Promise<void> {
    const { smartPasteExtension } = await import('@/extensions/smart-paste/pasteHandler')
    this.addEditorExtension(smartPasteExtension)
  }
}

export const smartPastePluginInstance = new SmartPastePlugin()
