import { BasePlugin } from '@/plugin-system'

class LivePreviewPlugin extends BasePlugin {
  constructor() {
    super({
      id: 'live-preview',
      name: '实时预览',
      description: '编辑器内嵌 Markdown 实时渲染',
      version: '1.0.0',
      icon: 'View',
      enabledByDefault: true,
    })
  }

  protected async onActivate(): Promise<void> {
    const { createLivePreviewPlugin } = await import('@/extensions/live-preview/livePreviewPlugin')
    await import('@/extensions/live-preview/styles.css')
    this.addEditorExtension(() => createLivePreviewPlugin())
  }
}

export const livePreviewPluginInstance = new LivePreviewPlugin()
