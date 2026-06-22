import { BasePlugin } from '@/plugin-system'

class MultimodalPlugin extends BasePlugin {
  constructor() {
    super({
      id: 'multimodal',
      name: '多模态输入',
      description: '图片拖拽、OCR 识别、PDF 拖拽提取',
      version: '1.0.0',
      icon: 'Picture',
      enabledByDefault: true,
    })
  }

  protected async onActivate(): Promise<void> {
    const { dropHandlerExtension } = await import('@/extensions/multimodal/dropHandler')
    this.addEditorExtension(dropHandlerExtension)
  }
}

export const multimodalPluginInstance = new MultimodalPlugin()
