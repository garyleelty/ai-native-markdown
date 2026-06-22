import { BasePlugin } from '@/plugin-system'

class InlineEditPlugin extends BasePlugin {
  constructor() {
    super({
      id: 'inline-edit',
      name: '内联编辑',
      description: '选中文本后 AI 重写建议（Diff 预览）',
      version: '1.0.0',
      icon: 'Edit',
      enabledByDefault: true,
    })
  }

  protected async onActivate(): Promise<void> {
    const { inlineEditPlugin, inlineEditKeymap } = await import('@/extensions/inline-edit/inlineEditPlugin')
    this.addEditorExtension([inlineEditPlugin, inlineEditKeymap])
  }
}

export const inlineEditPluginInstance = new InlineEditPlugin()
